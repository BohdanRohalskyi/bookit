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
	ID         int64
	UUID       uuid.UUID
	BusinessID int64
	Name       string
	CreatedAt  time.Time
}

type EquipmentCreate struct {
	BusinessID int64
	Name       string
}

// ─── Staff roles ──────────────────────────────────────────────────────────────

type StaffRole struct {
	ID         int64
	UUID       uuid.UUID
	BusinessID int64
	JobTitle   string
	CreatedAt  time.Time
}

type StaffRoleCreate struct {
	BusinessID int64
	JobTitle   string
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
