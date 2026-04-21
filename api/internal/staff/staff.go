package staff

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInviteNotFound         = errors.New("invite not found")
	ErrInviteExpired          = errors.New("invite has expired")
	ErrInviteAlreadyUsed      = errors.New("invite has already been accepted")
	ErrMemberNotFound         = errors.New("member not found")
	ErrEmailAlreadyRegistered = errors.New("email already registered")
)

// AuthProvider is a minimal interface the staff service uses to create verified
// users and issue tokens without importing the auth package directly.
type AuthProvider interface {
	CreateVerifiedUser(ctx context.Context, email, password, name string) (int64, error)
	IssueTokens(ctx context.Context, userID int64) (*AuthResult, error)
}

// AuthResult holds the tokens returned after registration via invite.
type AuthResult struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int
}

// RegisterResult is returned by RegisterAndAcceptInvite.
type RegisterResult struct {
	UserID   int64
	UserUUID uuid.UUID
	Email    string
	Name     string
	Tokens   AuthResult
}

// Member represents one entry in the business member list.
// Covers both active role assignments and pending invites.
type Member struct {
	ID     int64   `json:"id"`
	UserID *int64  `json:"user_id,omitempty"`
	Email  string  `json:"email"`
	Name   *string `json:"name,omitempty"`
	Photo  *string `json:"photo_url,omitempty"`
	// Role is one of "administrator" or "staff".
	Role       string `json:"role"`
	LocationID *int64 `json:"location_id,omitempty"`
	// Status is "active" for confirmed members or "pending" for outstanding invites.
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// Invite is the full invite record, returned on preview.
type Invite struct {
	ID           int64      `json:"id"`
	Email        string     `json:"email"`
	FullName     *string    `json:"full_name,omitempty"`
	RoleID       int64      `json:"role_id"`
	RoleSlug     string     `json:"role"`
	BusinessID   int64      `json:"business_id"`
	BusinessName string     `json:"business_name"`
	LocationID   *int64     `json:"location_id,omitempty"`
	InvitedBy    int64      `json:"invited_by"`
	ExpiresAt    time.Time  `json:"expires_at"`
	AcceptedAt   *time.Time `json:"accepted_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	// UserExists is set on preview — tells the frontend which acceptance form to show.
	UserExists bool `json:"user_exists"`
}

// InviteCreate is the input for creating a new invite record.
type InviteCreate struct {
	Email      string
	FullName   string
	RoleID     int64
	BusinessID int64
	LocationID *int64
	InvitedBy  int64
	TokenHash  string
	ExpiresAt  time.Time
}

// InviteMemberInput is the service-layer input for InviteMember.
type InviteMemberInput struct {
	Email      string
	FullName   string
	RoleSlug   string // "administrator" | "staff"
	BusinessID int64
	LocationID *int64
	InvitedBy  int64
}

// MemberProfile is the per-business profile of a staff member.
type MemberProfile struct {
	ID         int64     `json:"id"`
	UserID     int64     `json:"user_id"`
	BusinessID int64     `json:"business_id"`
	FullName   string    `json:"full_name"`
	PhotoURL   *string   `json:"photo_url,omitempty"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// OwnedBusiness is one business the user owns, used in the memberships response.
type OwnedBusiness struct {
	BusinessID   int64  `json:"business_id"`
	BusinessName string `json:"business_name"`
	Category     string `json:"category"`
	IsActive     bool   `json:"is_active"`
}

// MembershipsResponse is returned by GET /me/memberships.
type MembershipsResponse struct {
	Owned       []OwnedBusiness `json:"owned"`
	Memberships []Membership    `json:"memberships"`
}

// Membership is one role-assigned business space for the user.
type Membership struct {
	BusinessID   int64   `json:"business_id"`
	BusinessName string  `json:"business_name"`
	Category     string  `json:"category"`
	IsActive     bool    `json:"is_active"`
	Role         string  `json:"role"`
	LocationIDs  []int64 `json:"location_ids"`
}
