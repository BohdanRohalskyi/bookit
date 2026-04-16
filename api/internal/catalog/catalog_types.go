package catalog

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrEquipmentNotFound    = errors.New("equipment not found")
	ErrStaffRoleNotFound    = errors.New("staff role not found")
	ErrServiceNotFound      = errors.New("service not found")
	ErrLocationItemNotFound = errors.New("location item not found")
)

// ─── Equipment ────────────────────────────────────────────────────────────────

type Equipment struct {
	ID         uuid.UUID
	BusinessID uuid.UUID
	Name       string
	CreatedAt  time.Time
}

type EquipmentCreate struct {
	BusinessID uuid.UUID
	Name       string
}

// ─── Staff roles ──────────────────────────────────────────────────────────────

type StaffRole struct {
	ID         uuid.UUID
	BusinessID uuid.UUID
	JobTitle   string
	CreatedAt  time.Time
}

type StaffRoleCreate struct {
	BusinessID uuid.UUID
	JobTitle   string
}

// ─── Services ─────────────────────────────────────────────────────────────────

type ServiceEquipmentReq struct {
	EquipmentID    uuid.UUID
	EquipmentName  string
	QuantityNeeded int
}

type ServiceStaffReq struct {
	StaffRoleID    uuid.UUID
	JobTitle       string
	QuantityNeeded int
}

type ServiceItem struct {
	ID              uuid.UUID
	BusinessID      uuid.UUID
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
	EquipmentID    uuid.UUID
	StaffRoleID    uuid.UUID
	QuantityNeeded int
}

type ServiceItemCreate struct {
	BusinessID      uuid.UUID
	Name            string
	Description     *string
	DurationMinutes int
	Price           float64
	Currency        string
	EquipmentReqs   []ServiceCreateReqItem
	StaffReqs       []ServiceCreateReqItem
}

// ─── Location pivots ──────────────────────────────────────────────────────────

type LocationEquipment struct {
	ID            uuid.UUID
	LocationID    uuid.UUID
	EquipmentID   uuid.UUID
	EquipmentName string
	Quantity      int
}

type LocationEquipmentCreate struct {
	EquipmentID uuid.UUID
	Quantity    int
}

type LocationStaffRole struct {
	ID          uuid.UUID
	LocationID  uuid.UUID
	StaffRoleID uuid.UUID
	JobTitle    string
	Quantity    int
}

type LocationStaffRoleCreate struct {
	StaffRoleID uuid.UUID
	Quantity    int
}

type LocationServiceItem struct {
	ID          uuid.UUID
	LocationID  uuid.UUID
	ServiceID   uuid.UUID
	IsActive    bool
	ServiceItem ServiceItem
}

type LocationServiceItemCreate struct {
	ServiceID uuid.UUID
}
