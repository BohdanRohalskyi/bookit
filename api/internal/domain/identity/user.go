package identity

import (
	"time"

	"github.com/google/uuid"
)

type Provider struct {
	ID        int64
	UUID      uuid.UUID
	UserID    int64
	Status    string
	CreatedAt time.Time
}

type ProviderResponse struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

func (p *Provider) ToResponse() ProviderResponse {
	return ProviderResponse{
		ID:        p.UUID.String(),
		UserID:    p.UUID.String(), // expose provider UUID; user UUID not stored here
		Status:    p.Status,
		CreatedAt: p.CreatedAt,
	}
}

type User struct {
	ID            int64
	UUID          uuid.UUID
	Email         string
	PasswordHash  string
	Name          string
	Phone         *string
	EmailVerified bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type UserResponse struct {
	ID            string    `json:"id"`
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
		ID:            u.UUID.String(),
		Email:         u.Email,
		Name:          u.Name,
		Phone:         u.Phone,
		EmailVerified: u.EmailVerified,
		IsProvider:    isProvider,
		CreatedAt:     u.CreatedAt,
		UpdatedAt:     u.UpdatedAt,
	}
}
