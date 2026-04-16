package staff

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInviteNotFound    = errors.New("invite not found")
	ErrInviteExpired     = errors.New("invite has expired")
	ErrInviteAlreadyUsed = errors.New("invite has already been accepted")
	ErrMemberNotFound    = errors.New("member not found")
)

// Member represents one entry in the business member list.
// Covers both active role assignments and pending invites.
type Member struct {
	ID         uuid.UUID  `json:"id"`
	UserID     *uuid.UUID `json:"user_id,omitempty"`
	Email      string     `json:"email"`
	Name       *string    `json:"name,omitempty"`
	// Role is one of "administrator" or "staff".
	Role       string     `json:"role"`
	LocationID *uuid.UUID `json:"location_id,omitempty"`
	// Status is "active" for confirmed members or "pending" for outstanding invites.
	Status    string    `json:"status"`
	CreatedAt  time.Time  `json:"created_at"`
}

// Invite is the full invite record, returned on preview.
type Invite struct {
	ID           uuid.UUID  `json:"id"`
	Email        string     `json:"email"`
	RoleID       uuid.UUID  `json:"role_id"`
	RoleSlug     string     `json:"role"`
	BusinessID   uuid.UUID  `json:"business_id"`
	BusinessName string     `json:"business_name"`
	LocationID   *uuid.UUID `json:"location_id,omitempty"`
	InvitedBy    uuid.UUID  `json:"invited_by"`
	ExpiresAt    time.Time  `json:"expires_at"`
	AcceptedAt   *time.Time `json:"accepted_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// InviteCreate is the input for creating a new invite record.
type InviteCreate struct {
	Email      string
	RoleID     uuid.UUID
	BusinessID uuid.UUID
	LocationID *uuid.UUID
	InvitedBy  uuid.UUID
	TokenHash  string
	ExpiresAt  time.Time
}

// OwnedBusiness is one business the user owns, used in the memberships response.
type OwnedBusiness struct {
	BusinessID   uuid.UUID `json:"business_id"`
	BusinessName string    `json:"business_name"`
	Category     string    `json:"category"`
	IsActive     bool      `json:"is_active"`
}

// MembershipsResponse is returned by GET /me/memberships.
type MembershipsResponse struct {
	Owned       []OwnedBusiness `json:"owned"`
	Memberships []Membership    `json:"memberships"`
}

// Membership is one role-assigned business space for the user.
type Membership struct {
	BusinessID   uuid.UUID   `json:"business_id"`
	BusinessName string      `json:"business_name"`
	Category     string      `json:"category"`
	IsActive     bool        `json:"is_active"`
	Role         string      `json:"role"`
	LocationIDs  []uuid.UUID `json:"location_ids"`
}
