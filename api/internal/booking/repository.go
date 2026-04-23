package booking

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// bookingRepository is the narrow interface used by Handler and Service.
// The concrete Repository satisfies it; tests use mockRepo.
type bookingRepository interface {
	GetServiceSchedule(ctx context.Context, serviceUUID uuid.UUID, date time.Time) (*ServiceScheduleInfo, error)
	GetBookedStartTimes(ctx context.Context, serviceID int64, date time.Time) ([]string, error)
	Create(ctx context.Context, req CreateBookingReq) (*BookingRow, error)
	GetByUUID(ctx context.Context, bookingUUID uuid.UUID, consumerID int64) (*BookingRow, error)
	ListByConsumer(ctx context.Context, consumerID int64, status *string, page, perPage int) ([]BookingRow, int, error)
	ListByProvider(ctx context.Context, providerUserID int64, locationUUID *string, status *string, fromDate *string, toDate *string, page, perPage int) ([]BookingRow, int, error)
	UpdateStatus(ctx context.Context, bookingUUID uuid.UUID, providerUserID int64, toStatus string, reason *string) (*BookingRow, error)
	Reschedule(ctx context.Context, bookingUUID uuid.UUID, providerUserID int64, newStart time.Time) (*BookingRow, error)
}

// Repository implements bookingRepository against Postgres.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// GetServiceSchedule returns the service duration and the schedule for the
// given date's day-of-week at the first active location offering the service.
func (r *Repository) GetServiceSchedule(ctx context.Context, serviceUUID uuid.UUID, date time.Time) (*ServiceScheduleInfo, error) {
	// day_of_week: 0=Mon … 6=Sun (matches our schedule_days convention)
	dow := int(date.Weekday()+6) % 7

	var info ServiceScheduleInfo
	err := r.db.QueryRow(ctx, `
		SELECT
			s.id, s.uuid, s.duration_minutes,
			l.id, l.uuid,
			sd.is_open,
			TO_CHAR(sd.open_time, 'HH24:MI'),
			TO_CHAR(sd.close_time, 'HH24:MI')
		FROM services s
		JOIN location_services ls ON ls.service_id = s.id AND ls.is_active = true
		JOIN locations l           ON l.id = ls.location_id AND l.is_active = true
		JOIN schedules sch         ON sch.location_id = l.id
		JOIN schedule_days sd      ON sd.schedule_id = sch.id AND sd.day_of_week = $2
		WHERE s.uuid = $1
		LIMIT 1
	`, serviceUUID, dow).Scan(
		&info.ServiceID, &info.ServiceUUID, &info.DurationMinutes,
		&info.LocationID, &info.LocationUUID,
		&info.IsOpen, &info.OpenTime, &info.CloseTime,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrServiceNotFound
	}
	if err != nil {
		return nil, err
	}
	return &info, nil
}

// GetBookedStartTimes returns "HH:MM" start times for non-canceled booking
// items for the given service on the given date (UTC).
func (r *Repository) GetBookedStartTimes(ctx context.Context, serviceID int64, date time.Time) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		SELECT TO_CHAR(start_at AT TIME ZONE 'UTC', 'HH24:MI')
		FROM booking_items
		WHERE service_id = $1
		  AND start_at::date = $2::date
		  AND status != 'cancelled'
	`, serviceID, date.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var times []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		times = append(times, t)
	}
	return times, rows.Err()
}

// Create inserts a booking and its items inside a transaction.
// Returns ErrSlotTaken if any item conflicts with an existing booking.
func (r *Repository) Create(ctx context.Context, req CreateBookingReq) (*BookingRow, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }() //nolint:errcheck

	// Lock-and-check each item slot
	for _, item := range req.Items {
		var exists bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM booking_items
				WHERE service_id = $1 AND start_at = $2 AND status != 'cancelled'
				FOR UPDATE
			)
		`, item.ServiceID, item.StartAt).Scan(&exists); err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrSlotTaken
		}
	}

	// Compute total
	var total float64
	for _, item := range req.Items {
		total += item.Price
	}

	// Insert booking
	var bookingID int64
	var bookingUUID uuid.UUID
	if err := tx.QueryRow(ctx, `
		INSERT INTO bookings (location_id, consumer_id, status, total_amount, currency, notes)
		VALUES ($1, $2, 'confirmed', $3, 'EUR', $4)
		RETURNING id, uuid
	`, req.LocationID, req.ConsumerID, total, req.Notes).Scan(&bookingID, &bookingUUID); err != nil {
		return nil, err
	}

	// Insert items
	for _, item := range req.Items {
		endAt := item.StartAt.Add(time.Duration(item.DurationMinutes) * time.Minute)
		if _, err := tx.Exec(ctx, `
			INSERT INTO booking_items (booking_id, service_id, start_at, end_at, duration_minutes, price, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
		`, bookingID, item.ServiceID, item.StartAt, endAt, item.DurationMinutes, item.Price); err != nil {
			if isUniqueViolation(err) {
				return nil, ErrSlotTaken
			}
			return nil, fmt.Errorf("insert booking item: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetByUUID(ctx, bookingUUID, req.ConsumerID)
}

// getByBookingID fetches a booking by its internal int64 id without ownership checks.
func (r *Repository) getByBookingID(ctx context.Context, id int64) (*BookingRow, error) {
	var b BookingRow
	err := r.db.QueryRow(ctx, `
		SELECT b.id, b.uuid, b.location_id, l.uuid,
		       b.consumer_id, u.uuid, u.name, u.email,
		       b.status, b.total_amount::float8, b.currency, b.notes,
		       b.created_at, b.updated_at
		FROM bookings b
		JOIN locations l ON l.id = b.location_id
		JOIN users u     ON u.id = b.consumer_id
		WHERE b.id = $1
	`, id).Scan(
		&b.ID, &b.UUID, &b.LocationID, &b.LocationUUID,
		&b.ConsumerID, &b.ConsumerUUID, &b.ConsumerName, &b.ConsumerEmail,
		&b.Status, &b.TotalAmount, &b.Currency, &b.Notes,
		&b.CreatedAt, &b.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBookingNotFound
	}
	if err != nil {
		return nil, err
	}
	items, err := r.getItems(ctx, b.ID)
	if err != nil {
		return nil, err
	}
	b.Items = items
	return &b, nil
}

// GetByUUID fetches a booking with its items. Returns ErrBookingNotFound if
// the booking does not belong to the given consumer.
func (r *Repository) GetByUUID(ctx context.Context, bookingUUID uuid.UUID, consumerID int64) (*BookingRow, error) {
	var b BookingRow
	err := r.db.QueryRow(ctx, `
		SELECT b.id, b.uuid, b.location_id, l.uuid,
		       b.consumer_id, u.uuid, u.name, u.email,
		       b.status, b.total_amount::float8, b.currency, b.notes,
		       b.created_at, b.updated_at
		FROM bookings b
		JOIN locations l ON l.id = b.location_id
		JOIN users u     ON u.id = b.consumer_id
		WHERE b.uuid = $1 AND b.consumer_id = $2
	`, bookingUUID, consumerID).Scan(
		&b.ID, &b.UUID, &b.LocationID, &b.LocationUUID,
		&b.ConsumerID, &b.ConsumerUUID, &b.ConsumerName, &b.ConsumerEmail,
		&b.Status, &b.TotalAmount, &b.Currency, &b.Notes,
		&b.CreatedAt, &b.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBookingNotFound
	}
	if err != nil {
		return nil, err
	}

	items, err := r.getItems(ctx, b.ID)
	if err != nil {
		return nil, err
	}
	b.Items = items
	return &b, nil
}

// ListByConsumer returns paginated bookings for a consumer, optionally filtered by status.
func (r *Repository) ListByConsumer(ctx context.Context, consumerID int64, status *string, page, perPage int) ([]BookingRow, int, error) {
	args := []any{consumerID}
	where := "WHERE b.consumer_id = $1"
	if status != nil {
		args = append(args, *status)
		where += fmt.Sprintf(" AND b.status = $%d", len(args))
	}

	var total int
	if err := r.db.QueryRow(ctx,
		"SELECT COUNT(*) FROM bookings b "+where, args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	args = append(args, perPage, offset)
	rows, err := r.db.Query(ctx, `
		SELECT b.id, b.uuid, b.location_id, l.uuid,
		       b.consumer_id, u.uuid,
		       b.status, b.total_amount::float8, b.currency, b.notes,
		       b.created_at, b.updated_at
		FROM bookings b
		JOIN locations l ON l.id = b.location_id
		JOIN users u     ON u.id = b.consumer_id
		`+where+fmt.Sprintf(`
		ORDER BY b.created_at DESC
		LIMIT $%d OFFSET $%d
	`, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var bookings []BookingRow
	for rows.Next() {
		var b BookingRow
		if err := rows.Scan(
			&b.ID, &b.UUID, &b.LocationID, &b.LocationUUID,
			&b.ConsumerID, &b.ConsumerUUID,
			&b.Status, &b.TotalAmount, &b.Currency, &b.Notes,
			&b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		bookings = append(bookings, b)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	// Fetch items for each booking
	for i, b := range bookings {
		items, err := r.getItems(ctx, b.ID)
		if err != nil {
			return nil, 0, err
		}
		bookings[i].Items = items
	}
	if bookings == nil {
		bookings = []BookingRow{}
	}
	return bookings, total, nil
}

func (r *Repository) getItems(ctx context.Context, bookingID int64) ([]BookingItemRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT bi.id, bi.uuid, bi.service_id, s.uuid, s.name,
		       bi.start_at, bi.end_at, bi.duration_minutes, bi.price::float8, bi.status
		FROM booking_items bi
		JOIN services s ON s.id = bi.service_id
		WHERE bi.booking_id = $1
		ORDER BY bi.start_at
	`, bookingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []BookingItemRow
	for rows.Next() {
		var item BookingItemRow
		if err := rows.Scan(
			&item.ID, &item.UUID, &item.ServiceID, &item.ServiceUUID, &item.ServiceName,
			&item.StartAt, &item.EndAt, &item.DurationMinutes, &item.Price, &item.Status,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if items == nil {
		items = []BookingItemRow{}
	}
	return items, rows.Err()
}

// ListByProvider returns bookings for all locations belonging to the provider's businesses.
// Optionally filters by location_id UUID, status, and date range.
func (r *Repository) ListByProvider(ctx context.Context, providerUserID int64, locationUUID *string, status *string, fromDate *string, toDate *string, page, perPage int) ([]BookingRow, int, error) {
	args := []any{providerUserID}
	where := `
		WHERE p.user_id = $1
	`
	if locationUUID != nil {
		args = append(args, *locationUUID)
		where += fmt.Sprintf(" AND l.uuid = $%d::uuid", len(args))
	}
	if status != nil {
		args = append(args, *status)
		where += fmt.Sprintf(" AND b.status = $%d", len(args))
	}
	if fromDate != nil {
		args = append(args, *fromDate)
		where += fmt.Sprintf(" AND b.created_at::date >= $%d::date", len(args))
	}
	if toDate != nil {
		args = append(args, *toDate)
		where += fmt.Sprintf(" AND b.created_at::date <= $%d::date", len(args))
	}

	baseFrom := `
		FROM bookings b
		JOIN locations l   ON l.id = b.location_id
		JOIN businesses bz ON bz.id = l.business_id
		JOIN providers p   ON p.id = bz.provider_id
		JOIN users u       ON u.id = b.consumer_id
	` + where

	var total int
	if err := r.db.QueryRow(ctx, "SELECT COUNT(*) "+baseFrom, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	dataArgs := append(args, perPage, offset)
	rows, err := r.db.Query(ctx, `
		SELECT b.id, b.uuid, b.location_id, l.uuid,
		       b.consumer_id, u.uuid, u.name, u.email,
		       b.status, b.total_amount::float8, b.currency, b.notes,
		       b.created_at, b.updated_at
		`+baseFrom+fmt.Sprintf(`
		ORDER BY b.created_at DESC
		LIMIT $%d OFFSET $%d
	`, len(dataArgs)-1, len(dataArgs)), dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var bookings []BookingRow
	for rows.Next() {
		var b BookingRow
		if err := rows.Scan(
			&b.ID, &b.UUID, &b.LocationID, &b.LocationUUID,
			&b.ConsumerID, &b.ConsumerUUID, &b.ConsumerName, &b.ConsumerEmail,
			&b.Status, &b.TotalAmount, &b.Currency, &b.Notes,
			&b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		bookings = append(bookings, b)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	for i, b := range bookings {
		items, err := r.getItems(ctx, b.ID)
		if err != nil {
			return nil, 0, err
		}
		bookings[i].Items = items
	}
	if bookings == nil {
		bookings = []BookingRow{}
	}
	return bookings, total, nil
}

// UpdateStatus transitions a booking's status, validates the transition, and logs it.
// providerUserID must own the business that the booking's location belongs to.
func (r *Repository) UpdateStatus(ctx context.Context, bookingUUID uuid.UUID, providerUserID int64, toStatus string, reason *string) (*BookingRow, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }() //nolint:errcheck

	// Fetch current status + verify ownership
	var bookingID int64
	var fromStatus string
	err = tx.QueryRow(ctx, `
		SELECT b.id, b.status
		FROM bookings b
		JOIN locations l   ON l.id = b.location_id
		JOIN businesses bz ON bz.id = l.business_id
		JOIN providers p   ON p.id = bz.provider_id
		WHERE b.uuid = $1 AND p.user_id = $2
		FOR UPDATE
	`, bookingUUID, providerUserID).Scan(&bookingID, &fromStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBookingNotFound
	}
	if err != nil {
		return nil, err
	}

	// Validate transition
	if !validTransitions[fromStatus][toStatus] {
		return nil, ErrInvalidTransition
	}

	// Update booking status
	if _, err := tx.Exec(ctx,
		`UPDATE bookings SET status=$1, updated_at=NOW() WHERE id=$2`,
		toStatus, bookingID,
	); err != nil {
		return nil, err
	}

	// Update booking_items status where applicable
	var itemStatus string
	switch toStatus {
	case "cancelled_by_provider": //nolint:misspell
		itemStatus = "cancelled" //nolint:misspell
	case "completed":
		itemStatus = "completed"
	default:
		itemStatus = "confirmed"
	}
	if _, err := tx.Exec(ctx,
		`UPDATE booking_items SET status=$1 WHERE booking_id=$2 AND status != 'cancelled'`,
		itemStatus, bookingID,
	); err != nil {
		return nil, err
	}

	// Log status history
	if _, err := tx.Exec(ctx, `
		INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by, reason)
		VALUES ($1, $2, $3, $4, $5)
	`, bookingID, fromStatus, toStatus, providerUserID, reason); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.getByBookingID(ctx, bookingID)
}

// Reschedule moves all items of a booking to a new start time.
// Returns ErrBookingNotFound if the booking doesn't belong to the provider.
// Returns ErrSlotTaken if the new slot conflicts with an existing booking.
func (r *Repository) Reschedule(ctx context.Context, bookingUUID uuid.UUID, providerUserID int64, newStart time.Time) (*BookingRow, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }() //nolint:errcheck

	// Fetch booking + verify provider owns it
	var bookingID int64
	var serviceID int64
	var durationMinutes int
	err = tx.QueryRow(ctx, `
		SELECT b.id, bi.service_id, bi.duration_minutes
		FROM bookings b
		JOIN booking_items bi  ON bi.booking_id = b.id
		JOIN locations l       ON l.id = b.location_id
		JOIN businesses bz     ON bz.id = l.business_id
		JOIN providers p       ON p.id = bz.provider_id
		WHERE b.uuid = $1 AND p.user_id = $2
		LIMIT 1
		FOR UPDATE
	`, bookingUUID, providerUserID).Scan(&bookingID, &serviceID, &durationMinutes)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBookingNotFound
	}
	if err != nil {
		return nil, err
	}

	// Check new slot is free for this service
	var conflict bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM booking_items
			WHERE service_id = $1 AND start_at = $2
			  AND status != 'cancelled'
			  AND booking_id != $3
		)
	`, serviceID, newStart, bookingID).Scan(&conflict); err != nil {
		return nil, err
	}
	if conflict {
		return nil, ErrSlotTaken
	}

	newEnd := newStart.Add(time.Duration(durationMinutes) * time.Minute)
	if _, err := tx.Exec(ctx, `
		UPDATE booking_items SET start_at=$1, end_at=$2 WHERE booking_id=$3
	`, newStart, newEnd, bookingID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE bookings SET updated_at=NOW() WHERE id=$1`, bookingID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.getByBookingID(ctx, bookingID)
}

func isUniqueViolation(err error) bool {
	return err != nil && (err.Error() == "ERROR: duplicate key value violates unique constraint" ||
		containsString(err.Error(), "unique constraint") ||
		containsString(err.Error(), "booking_items_no_overlap"))
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsAt(s, substr))
}

func containsAt(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
