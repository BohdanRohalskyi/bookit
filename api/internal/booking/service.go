package booking

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/BohdanRohalskyi/bookit/api/internal/mail"
)

// Service orchestrates availability and booking creation.
type Service struct {
	repo      bookingRepository
	mail      mail.Provider
	templates *mail.Templates
}

func NewService(repo bookingRepository, mailProvider mail.Provider, templates *mail.Templates) *Service {
	return &Service{repo: repo, mail: mailProvider, templates: templates}
}

// GetAvailableSlots computes available time windows for a service on a date.
func (s *Service) GetAvailableSlots(ctx context.Context, serviceUUID uuid.UUID, date time.Time) (*ServiceScheduleInfo, []Slot, error) {
	info, err := s.repo.GetServiceSchedule(ctx, serviceUUID, date)
	if err != nil {
		return nil, nil, err
	}

	if !info.IsOpen {
		return info, []Slot{}, nil
	}

	bookedTimes, err := s.repo.GetBookedStartTimes(ctx, info.ServiceID, date)
	if err != nil {
		return nil, nil, err
	}

	openTime := ""
	closeTime := ""
	if info.OpenTime != nil {
		openTime = *info.OpenTime
	}
	if info.CloseTime != nil {
		closeTime = *info.CloseTime
	}

	slots := generateSlots(openTime, closeTime, info.DurationMinutes, bookedTimes)
	return info, slots, nil
}

// CreateBooking validates and persists a booking, then sends a confirmation email.
func (s *Service) CreateBooking(ctx context.Context, req CreateBookingReq) (*BookingRow, error) {
	booking, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, err
	}

	// Best-effort email — don't fail the booking if email fails
	s.sendConfirmationEmail(ctx, booking)

	return booking, nil
}

func (s *Service) GetBooking(ctx context.Context, bookingUUID uuid.UUID, consumerID int64) (*BookingRow, error) {
	return s.repo.GetByUUID(ctx, bookingUUID, consumerID)
}

func (s *Service) ListMyBookings(ctx context.Context, consumerID int64, status *string, page, perPage int) ([]BookingRow, int, error) {
	return s.repo.ListByConsumer(ctx, consumerID, status, page, perPage)
}

func (s *Service) sendConfirmationEmail(ctx context.Context, booking *BookingRow) {
	if s.mail == nil || s.templates == nil || len(booking.Items) == 0 {
		return
	}
	firstItem := booking.Items[0]
	data := mail.BookingConfirmationData{
		ServiceName:     firstItem.ServiceName,
		StartAt:         firstItem.StartAt,
		DurationMinutes: firstItem.DurationMinutes,
		BookingID:       booking.UUID.String(),
		AppURL:          s.templates.AppURL(),
	}
	_ = s.mail.Send(ctx, s.templates.BookingConfirmation(data)) //nolint:errcheck
}

// ─── Slot generation (pure — no DB) ──────────────────────────────────────────

func generateSlots(openTime, closeTime string, durationMin int, bookedStartTimes []string) []Slot {
	if openTime == "" || closeTime == "" || durationMin <= 0 {
		return nil
	}

	open, err := time.Parse("15:04", openTime)
	if err != nil {
		return nil
	}
	close, err := time.Parse("15:04", closeTime)
	if err != nil {
		return nil
	}

	booked := make(map[string]bool, len(bookedStartTimes))
	for _, t := range bookedStartTimes {
		booked[t] = true
	}

	dur := time.Duration(durationMin) * time.Minute
	var slots []Slot
	for cur := open; ; cur = cur.Add(dur) {
		end := cur.Add(dur)
		if end.After(close) {
			break
		}
		startStr := cur.Format("15:04")
		slots = append(slots, Slot{
			StartTime: startStr,
			EndTime:   end.Format("15:04"),
			Available: !booked[startStr],
		})
	}
	return slots
}
