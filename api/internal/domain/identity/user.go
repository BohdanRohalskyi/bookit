package identity

import (
	"time"

	"github.com/google/uuid"
)

type Provider struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Status    string
	CreatedAt time.Time
}

type ProviderResponse struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

func (p *Provider) ToResponse() ProviderResponse {
	return ProviderResponse{
		ID:        p.ID,
		UserID:    p.UserID,
		Status:    p.Status,
		CreatedAt: p.CreatedAt,
	}
}

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
