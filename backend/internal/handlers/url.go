package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/redis/go-redis/v9"

	"github.com/linkhub/backend/internal/cache"
	authmw "github.com/linkhub/backend/internal/middleware"
	"github.com/linkhub/backend/internal/models"
)

type URLHandler struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

func NewURLHandler(db *pgxpool.Pool, redis *redis.Client) *URLHandler {
	return &URLHandler{db: db, redis: redis}
}

func (h *URLHandler) Shorten(c echo.Context) error {
	var body struct {
		URL       string `json:"url"`
		ShortCode string `json:"short_code"` // optional; must be even length if provided
	}
	if err := c.Bind(&body); err != nil || strings.TrimSpace(body.URL) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "valid url is required"})
	}

	userID := c.Get(authmw.UserIDKey).(int64)

	code := strings.TrimSpace(body.ShortCode)
	if code != "" {
		if len(code)%2 != 0 {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "short_code must be even length"})
		}
	} else {
		var err error
		code, err = generateCode(6)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to generate short code"})
		}
	}

	var url models.URL
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO urls (short_code, original_url, user_id) VALUES ($1, $2, $3)
		 RETURNING id, short_code, original_url, click_count, is_active, user_id, created_at`,
		code, body.URL, userID,
	).Scan(&url.ID, &url.ShortCode, &url.OriginalURL, &url.ClickCount, &url.IsActive, &url.UserID, &url.CreatedAt)
	if err != nil {
		c.Logger().Errorf("insert url failed: %v", err)
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			return c.JSON(http.StatusConflict, map[string]string{"error": "short_code already in use"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save url"})
	}

	h.redis.Set(context.Background(), cache.URLKey(code), url.OriginalURL, cache.PositiveTTL)

	return c.JSON(http.StatusCreated, url)
}

func (h *URLHandler) Redirect(c echo.Context) error {
	code := c.Param("code")
	ctx := context.Background()
	key := cache.URLKey(code)

	// 1. Check Redis
	cached, err := h.redis.Get(ctx, key).Result()
	if err == nil {
		if cached == cache.NotFoundSentinel {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "short url not found"})
		}
		// Increment click count in background — don't block the redirect
		go h.db.Exec(context.Background(), //nolint:errcheck
			`UPDATE urls SET click_count = click_count + 1 WHERE short_code = $1`, code)
		return c.Redirect(http.StatusFound, cached)
	}

	// 2. Cache miss — query DB
	var originalURL string
	err = h.db.QueryRow(ctx,
		`UPDATE urls SET click_count = click_count + 1
		 WHERE short_code = $1 AND is_active = TRUE RETURNING original_url`,
		code,
	).Scan(&originalURL)

	if errors.Is(err, pgx.ErrNoRows) {
		// Mark as not-found in Redis so future requests skip the DB
		h.redis.Set(ctx, key, cache.NotFoundSentinel, cache.NegativeTTL)
		return c.JSON(http.StatusNotFound, map[string]string{"error": "short url not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	// Cache the found URL
	h.redis.Set(ctx, key, originalURL, cache.PositiveTTL)

	return c.Redirect(http.StatusFound, originalURL)
}

func (h *URLHandler) GetStats(c echo.Context) error {
	code := c.Param("code")

	var url models.URL
	err := h.db.QueryRow(context.Background(),
		`SELECT id, short_code, original_url, click_count, is_active, user_id, created_at FROM urls WHERE short_code = $1`,
		code,
	).Scan(&url.ID, &url.ShortCode, &url.OriginalURL, &url.ClickCount, &url.IsActive, &url.UserID, &url.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "short url not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	return c.JSON(http.StatusOK, url)
}

func (h *URLHandler) Deactivate(c echo.Context) error {
	code := c.Param("code")
	userID := c.Get(authmw.UserIDKey).(int64)
	ctx := context.Background()

	tag, err := h.db.Exec(ctx,
		`UPDATE urls SET is_active = FALSE WHERE short_code = $1 AND user_id = $2 AND is_active = TRUE`,
		code, userID,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
	if tag.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "url not found, already inactive, or not owned by you"})
	}

	// Invalidate cache so redirects stop immediately
	h.redis.Del(ctx, cache.URLKey(code))

	return c.JSON(http.StatusOK, map[string]string{"message": "url deactivated"})
}

func (h *URLHandler) Activate(c echo.Context) error {
	code := c.Param("code")
	userID := c.Get(authmw.UserIDKey).(int64)
	ctx := context.Background()

	var originalURL string
	err := h.db.QueryRow(ctx,
		`UPDATE urls SET is_active = TRUE WHERE short_code = $1 AND user_id = $2 AND is_active = FALSE
		 RETURNING original_url`,
		code, userID,
	).Scan(&originalURL)

	if errors.Is(err, pgx.ErrNoRows) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "url not found, already active, or not owned by you"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	// Re-populate cache so redirects resume immediately
	h.redis.Set(ctx, cache.URLKey(code), originalURL, cache.PositiveTTL)

	return c.JSON(http.StatusOK, map[string]string{"message": "url activated"})
}

func (h *URLHandler) ListUserURLs(c echo.Context) error {
	userID := c.Get(authmw.UserIDKey).(int64)
	ctx := context.Background()

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	// status=active | status=inactive | omitted/anything else = all
	var statusFilter string
	switch c.QueryParam("status") {
	case "active":
		statusFilter = "AND is_active = TRUE"
	case "inactive":
		statusFilter = "AND is_active = FALSE"
	}

	var total int64
	if err := h.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM urls WHERE user_id = $1 `+statusFilter,
		userID,
	).Scan(&total); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	rows, err := h.db.Query(ctx,
		`SELECT short_code, original_url, click_count, is_active, created_at
		 FROM urls WHERE user_id = $1 `+statusFilter+`
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		userID, limit, offset,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
	defer rows.Close()

	urls := make([]models.URL, 0)
	for rows.Next() {
		var u models.URL
		if err := rows.Scan(&u.ShortCode, &u.OriginalURL, &u.ClickCount, &u.IsActive, &u.CreatedAt); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
		}
		urls = append(urls, u)
	}

	return c.JSON(http.StatusOK, map[string]any{
		"data":  urls,
		"page":  page,
		"limit": limit,
		"total": total,
	})
}

func (h *URLHandler) TopURLs(c echo.Context) error {
	userID := c.Get(authmw.UserIDKey).(int64)
	ctx := context.Background()

	var statusFilter string
	switch c.QueryParam("status") {
	case "active":
		statusFilter = "AND is_active = TRUE"
	case "inactive":
		statusFilter = "AND is_active = FALSE"
	}

	rows, err := h.db.Query(ctx,
		`SELECT short_code, original_url, click_count, is_active, created_at
		 FROM urls WHERE user_id = $1 `+statusFilter+`
		 ORDER BY click_count DESC
		 LIMIT 10`,
		userID,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
	defer rows.Close()

	urls := make([]models.URL, 0)
	for rows.Next() {
		var u models.URL
		if err := rows.Scan(&u.ShortCode, &u.OriginalURL, &u.ClickCount, &u.IsActive, &u.CreatedAt); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
		}
		urls = append(urls, u)
	}

	return c.JSON(http.StatusOK, urls)
}

func generateCode(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b)[:length], nil
}
