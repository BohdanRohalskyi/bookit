package booking

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrBookingNotFound = errors.New("booking not found")
	ErrServiceNotFound = errors.New("service not found")
	ErrSlotTaken       = errors.New("time slot already booked")
)

// ServiceScheduleInfo holds the data needed to compute availability.
type ServiceScheduleInfo struct {
	ServiceID       int64
	ServiceUUID     uuid.UUID
	DurationMinutes int
	LocationID      int64
	LocationUUID    uuid.UUID
	IsOpen          bool
	OpenTime        *string // "HH:MM", nil when closed
	CloseTime       *string // "HH:MM", nil when closed
}

// Slot is a generated time window returned to the consumer.
type Slot struct {
	StartTime string // "HH:MM"
	EndTime   string // "HH:MM"
	Available bool
}

// BookingRow is the full booking returned from the DB.
type BookingRow struct {
	ID           int64
	UUID         uuid.UUID
	LocationID   int64
	LocationUUID uuid.UUID
	ConsumerID   int64
	ConsumerUUID uuid.UUID
	Status       string
	TotalAmount  float64
	Currency     string
	Notes        *string
	Items        []BookingItemRow
	CreatedAt    time.Time
	UpdatedAt    *time.Time
}

// BookingItemRow is a single service slot within a booking.
type BookingItemRow struct {
	ID              int64
	UUID            uuid.UUID
	ServiceID       int64
	ServiceUUID     uuid.UUID
	ServiceName     string
	StartAt         time.Time
	EndAt           time.Time
	DurationMinutes int
	Price           float64
	Status          string
}

// CreateBookingReq is the input to Repository.Create.
type CreateBookingReq struct {
	LocationID int64
	ConsumerID int64
	Notes      *string
	Items      []CreateBookingItemReq
}

type CreateBookingItemReq struct {
	ServiceID       int64
	ServiceUUID     uuid.UUID
	StartAt         time.Time
	DurationMinutes int
	Price           float64
}
