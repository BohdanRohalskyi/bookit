package catalog

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrBranchNotFound = errors.New("branch not found")
	ErrBranchNotOwner = errors.New("not the branch owner")
)

// Branch is the full branch entity returned from the DB.
type Branch struct {
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

type BranchCreate struct {
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

type BranchUpdate struct {
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
	BranchID   uuid.UUID
	Days       []ScheduleDay
	Exceptions []ScheduleException
}

type ScheduleDay struct {
	ID          uuid.UUID
	ScheduleID  uuid.UUID
	DayOfWeek   int // 0=Monday, 6=Sunday
	IsOpen      bool
	OpenTime    *string // "HH:MM"
	CloseTime   *string
}

type ScheduleDayInput struct {
	DayOfWeek int
	IsOpen    bool
	OpenTime  *string
	CloseTime *string
}

type ScheduleException struct {
	ID         uuid.UUID
	BranchID   uuid.UUID
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

// BranchPhoto types

type BranchPhoto struct {
	ID           uuid.UUID
	BranchID     uuid.UUID
	URL          string
	DisplayOrder int
	CreatedAt    time.Time
}
