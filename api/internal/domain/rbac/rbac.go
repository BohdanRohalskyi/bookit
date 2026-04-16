package rbac

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// ─── Sentinel errors ──────────────────────────────────────────────────────────

var (
	ErrAccessDenied       = errors.New("access denied")
	ErrAssignmentExists   = errors.New("role assignment already exists")
	ErrAssignmentNotFound = errors.New("role assignment not found")
)

// ─── Resource constants ───────────────────────────────────────────────────────

const (
	ResourceBusiness  = "business"
	ResourceLocation  = "location"
	ResourceStaff     = "staff"
	ResourceServices  = "services"
	ResourceEquipment = "equipment"
	ResourceBookings  = "bookings"
)

// ─── Action constants ─────────────────────────────────────────────────────────

const (
	ActionRead    = "read"
	ActionWrite   = "write"
	ActionDelete  = "delete"
	ActionReadOwn = "read_own"
)

// ─── System role slugs ────────────────────────────────────────────────────────
// Owner is intentionally absent — resolved via the providers table, not RBAC.

const (
	SlugAdministrator = "administrator"
	SlugStaff         = "staff"
)

// ─── Domain types ─────────────────────────────────────────────────────────────

// Permission is a single resource+action pair belonging to a role.
type Permission struct {
	ID       uuid.UUID
	RoleID   uuid.UUID
	Resource string
	Action   string
}

// UserRoleAssignment links a user to a role within a business scope.
// LocationID nil means the assignment covers all locations of that business.
type UserRoleAssignment struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	RoleID     uuid.UUID
	BusinessID uuid.UUID
	LocationID *uuid.UUID
	AssignedBy *uuid.UUID
	CreatedAt  time.Time
}

// AccessRequest carries the parameters for a single permission check.
type AccessRequest struct {
	UserID     uuid.UUID
	BusinessID uuid.UUID
	LocationID *uuid.UUID // nil when the request is not location-scoped
	Resource   string
	Action     string
}

// Membership represents one business space a user belongs to,
// returned by GetUserMemberships for the space picker.
type Membership struct {
	BusinessID   uuid.UUID
	BusinessName string
	Category     string
	IsActive     bool
	Role         string      // "administrator" | "staff"
	LocationIDs  []uuid.UUID // non-empty only for location-scoped assignments
}
