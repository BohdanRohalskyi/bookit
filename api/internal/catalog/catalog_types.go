package catalog

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrEquipmentNotFound    = errors.New("equipment not found")
	ErrEquipmentInUse       = errors.New("equipment is referenced by one or more services")
	ErrStaffRoleNotFound    = errors.New("staff role not found")
	ErrStaffRoleProtected   = errors.New("staff role is system-managed and cannot be deleted")
	ErrServiceNotFound      = errors.New("service not found")
	ErrLocationItemNotFound = errors.New("location item not found")
)

// ─── Equipment ────────────────────────────────────────────────────────────────

type Equipment struct {
	ID               int64
	UUID             uuid.UUID
	BusinessID       int64
	Name             string
	QuantityActive   int
	QuantityInactive int
	CreatedAt        time.Time
}

type EquipmentCreate struct {
	BusinessID       int64
	Name             string
	QuantityActive   int
	QuantityInactive int
}

type EquipmentUpdateReq struct {
	Name             *string
	QuantityActive   *int
	QuantityInactive *int
}

// ─── Staff roles ──────────────────────────────────────────────────────────────

type StaffRole struct {
	ID           int64
	UUID         uuid.UUID
	BusinessID   int64
	BusinessUUID uuid.UUID
	IsSystem     bool
	RoleID       int64  // internal FK to roles table
	RoleSlug     string // "administrator" | "staff" — exposed in JSON as "role"
	JobTitle     string
	CreatedAt    time.Time
}

type StaffRoleCreate struct {
	BusinessID int64
	RoleID     int64 // resolved from slug by caller
	JobTitle   string
	IsSystem   bool
}

// ─── Services ─────────────────────────────────────────────────────────────────

type ServiceEquipmentReq struct {
	EquipmentID    int64
	EquipmentUUID  uuid.UUID
	EquipmentName  string
	QuantityNeeded int
}

type ServiceStaffReq struct {
	StaffRoleID    int64
	StaffRoleUUID  uuid.UUID
	JobTitle       string
	QuantityNeeded int
}

type ServiceItem struct {
	ID              int64
	UUID            uuid.UUID
	BusinessID      int64
	Name            string
	Description     *string
	DurationMinutes int
	Price           float64
	Currency        string
	Equipment       []ServiceEquipmentReq
	Staff           []ServiceStaffReq
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type ServiceCreateReqItem struct {
	EquipmentID    int64
	StaffRoleID    int64
	QuantityNeeded int
}

type ServiceItemCreate struct {
	BusinessID      int64
	Name            string
	Description     *string
	DurationMinutes int
	Price           float64
	Currency        string
	EquipmentReqs   []ServiceCreateReqItem
	StaffReqs       []ServiceCreateReqItem
}

type ServiceItemUpdate struct {
	Name            *string
	Description     *string
	DurationMinutes *int
	Price           *float64
	Currency        *string
	EquipmentReqs   *[]ServiceCreateReqItem // nil = no change; non-nil = replace
}

// ─── Service search ───────────────────────────────────────────────────────────

type ServiceSearchParams struct {
	Q        *string
	Category *string
	City     *string
	Date     *string // reserved — requires scheduling domain
	Page     int
	PerPage  int
}

type ServiceSearchResultItem struct {
	UUID            uuid.UUID
	Name            string
	Description     *string
	DurationMinutes int
	Price           float64
	Currency        string
	BusinessUUID    uuid.UUID
	BusinessName    string
	Category        string
	City            *string
	CoverImageURL   *string
}

type ServiceDetail struct {
	UUID            uuid.UUID
	Name            string
	Description     *string
	DurationMinutes int
	Price           float64
	Currency        string
	BusinessUUID    uuid.UUID
	BusinessName    string
	Category        string
	City            *string
	CoverImageURL   *string
	CreatedAt       time.Time
}

// ─── Location pivots ──────────────────────────────────────────────────────────

type LocationEquipment struct {
	ID            int64
	UUID          uuid.UUID
	LocationID    int64
	EquipmentID   int64
	EquipmentUUID uuid.UUID
	EquipmentName string
	Quantity      int
}

type LocationEquipmentCreate struct {
	EquipmentID int64
	Quantity    int
}

type LocationStaffRole struct {
	ID            int64
	UUID          uuid.UUID
	LocationID    int64
	StaffRoleID   int64
	StaffRoleUUID uuid.UUID
	JobTitle      string
	Quantity      int
}

type LocationStaffRoleCreate struct {
	StaffRoleID int64
	Quantity    int
}

type LocationServiceItem struct {
	ID          int64
	UUID        uuid.UUID
	LocationID  int64
	ServiceID   int64
	IsActive    bool
	ServiceItem ServiceItem
}

type LocationServiceItemCreate struct {
	ServiceID int64
}
