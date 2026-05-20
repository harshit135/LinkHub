package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db *pgxpool.Pool
}

func NewAuthHandler(db *pgxpool.Pool) *AuthHandler {
	return &AuthHandler{db: db}
}

func (h *AuthHandler) Register(c echo.Context) error {
	var body struct {
		Email             string  `json:"email"`
		Password          string  `json:"password"`
		FirstName         *string `json:"first_name"`
		LastName          *string `json:"last_name"`
		Username *string `json:"username"`
	}
	if err := c.Bind(&body); err != nil || strings.TrimSpace(body.Email) == "" || body.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "email and password are required"})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	var userID int64
	err = h.db.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, first_name, last_name, username)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		strings.TrimSpace(body.Email), string(hash),
		body.FirstName, body.LastName, body.Username,
	).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			return c.JSON(http.StatusConflict, map[string]string{"error": "email or username already in use"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	accessToken, refreshToken, err := issueTokens(context.Background(), h.db, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to issue tokens"})
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *AuthHandler) Login(c echo.Context) error {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.Bind(&body); err != nil || body.Email == "" || body.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "email and password are required"})
	}

	var userID int64
	var passwordHash string
	err := h.db.QueryRow(context.Background(),
		`SELECT id, password_hash FROM users WHERE email = $1`,
		strings.TrimSpace(body.Email),
	).Scan(&userID, &passwordHash)

	// Use constant-time comparison regardless of whether user exists
	if errors.Is(err, pgx.ErrNoRows) {
		bcrypt.CompareHashAndPassword([]byte("$2a$10$placeholder"), []byte(body.Password)) //nolint:errcheck
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)) != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
	}

	// Revoke all existing sessions for this user before issuing a new one
	if _, err = h.db.Exec(context.Background(),
		`DELETE FROM refresh_tokens WHERE user_id = $1`, userID,
	); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	accessToken, refreshToken, err := issueTokens(context.Background(), h.db, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to issue tokens"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *AuthHandler) Refresh(c echo.Context) error {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.Bind(&body); err != nil || body.RefreshToken == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "refresh_token is required"})
	}

	raw, err := hex.DecodeString(body.RefreshToken)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
	}
	sum := sha256.Sum256(raw)
	tokenHash := hex.EncodeToString(sum[:])

	ctx := context.Background()
	var id, userID int64
	var expiresAt time.Time
	err = h.db.QueryRow(ctx,
		`SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&id, &userID, &expiresAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid or expired refresh token"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	// Always delete the token — expired or not — so it can't be reused
	if _, err = h.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE id = $1`, id); err != nil {
		c.Logger().Errorf("rotate refresh token: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}

	if time.Now().After(expiresAt) {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid or expired refresh token"})
	}

	accessToken, refreshToken, err := issueTokens(ctx, h.db, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to issue tokens"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.Bind(&body); err != nil || body.RefreshToken == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "refresh_token is required"})
	}

	raw, err := hex.DecodeString(body.RefreshToken)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]string{"message": "logged out"})
	}
	sum := sha256.Sum256(raw)
	tokenHash := hex.EncodeToString(sum[:])

	if _, err = h.db.Exec(context.Background(), `DELETE FROM refresh_tokens WHERE token_hash = $1`, tokenHash); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "logged out"})
}

// issueTokens mints a short-lived JWT access token and a long-lived refresh token,
// persisting the refresh token hash to the DB.
func issueTokens(ctx context.Context, db *pgxpool.Pool, userID int64) (accessToken, refreshToken string, err error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(15 * time.Minute).Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err = t.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return
	}

	raw := make([]byte, 32)
	if _, err = rand.Read(raw); err != nil {
		return
	}
	refreshToken = hex.EncodeToString(raw)
	sum := sha256.Sum256(raw)
	tokenHash := hex.EncodeToString(sum[:])

	_, err = db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		userID, tokenHash, time.Now().Add(7*24*time.Hour),
	)
	return
}
