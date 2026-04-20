package catalog

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrLocationNotFound = errors.New("location not found")
	ErrLocationNotOwner = errors.New("not the location owner")
)

// MemberAccess holds a member's role and location restrictions for a business.
// Restricted=false means the member has business-wide access (location_id IS NULL in their assignment).
// Restricted=true means they may only access the listed LocationIDs.
type MemberAccess struct {
	Role        string
	LocationIDs []uuid.UUID
	Restricted  bool
}

// Location is the full location entity returned from the DB.
type Location struct {
	ID         uuid.UUID
	BusinessID uuid.UUID
	Name       string
	Address    string
	City       string
	Country    string
	Phone      *string
	Email      *string
	Lat        *float64
	Lng        *float64
	Timezone   string
	IsActive   bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type LocationCreate struct {
	BusinessID uuid.UUID
	Name       string
	Address    string
	City       string
	Country    string
	Phone      *string
	Email      *string
	Lat        *float64
	Lng        *float64
	Timezone   string
}

type LocationUpdate struct {
	Name     *string
	Address  *string
	City     *string
	Country  *string
	Phone    *string
	Email    *string
	Lat      *float64
	Lng      *float64
	Timezone *string
	IsActive *bool
}

// Schedule types

type Schedule struct {
	ID         uuid.UUID
	LocationID uuid.UUID
	Days       []ScheduleDay
	Exceptions []ScheduleException
}

type ScheduleDay struct {
	ID         uuid.UUID
	ScheduleID uuid.UUID
	DayOfWeek  int // 0=Monday, 6=Sunday
	IsOpen     bool
	OpenTime   *string // "HH:MM"
	CloseTime  *string
}

type ScheduleDayInput struct {
	DayOfWeek int
	IsOpen    bool
	OpenTime  *string
	CloseTime *string
}

type ScheduleException struct {
	ID         uuid.UUID
	LocationID uuid.UUID
	ScheduleID uuid.UUID
	Date       string // "YYYY-MM-DD"
	IsClosed   bool
	OpenTime   *string
	CloseTime  *string
	Reason     *string
	CreatedAt  time.Time
}

type ScheduleExceptionCreate struct {
	Date      string
	IsClosed  bool
	OpenTime  *string
	CloseTime *string
	Reason    *string
}

// LocationPhoto types

type LocationPhoto struct {
	ID           uuid.UUID
	LocationID   uuid.UUID
	URL          string
	DisplayOrder int
	CreatedAt    time.Time
}
