package identity

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID
	Email         string
	PasswordHash  string
	Name          string
	Phone         *string
	EmailVerified bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type UserResponse struct {
	ID            uuid.UUID `json:"id"`
	Email         string    `json:"email"`
	Name          string    `json:"name"`
	Phone         *string   `json:"phone,omitempty"`
	EmailVerified bool      `json:"email_verified"`
	IsProvider    bool      `json:"is_provider"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (u *User) ToResponse(isProvider bool) UserResponse {
	return UserResponse{
		ID:            u.ID,
		Email:         u.Email,
		Name:          u.Name,
		Phone:         u.Phone,
		EmailVerified: u.EmailVerified,
		IsProvider:    isProvider,
		CreatedAt:     u.CreatedAt,
		UpdatedAt:     u.UpdatedAt,
	}
}
