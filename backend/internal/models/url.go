package models

import "time"

type URL struct {
	ID          int64     `json:"-"`
	ShortCode   string    `json:"short_code"`
	OriginalURL string    `json:"original_url"`
	ClickCount  int64     `json:"click_count"`
	IsActive    bool      `json:"is_active"`
	UserID      *int64    `json:"-"`
	CreatedAt   time.Time `json:"created_at"`
}
