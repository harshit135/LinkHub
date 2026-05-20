package models

import "time"

type User struct {
	ID                int64     `json:"id"`
	Email             string    `json:"email"`
	FirstName         *string   `json:"first_name,omitempty"`
	LastName          *string   `json:"last_name,omitempty"`
	Username *string   `json:"username,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}
