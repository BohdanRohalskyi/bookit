package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LocationRepository struct {
	db *pgxpool.Pool
}

func NewLocationRepository(db *pgxpool.Pool) *LocationRepository {
	return &LocationRepository{db: db}
}

func scanLocation(row pgx.Row) (Location, error) {
	var l Location
	err := row.Scan(
		&l.ID, &l.BusinessID, &l.Name, &l.Address, &l.City, &l.Country,
		&l.Phone, &l.Email, &l.Lat, &l.Lng, &l.Timezone, &l.IsActive,
		&l.CreatedAt, &l.UpdatedAt,
	)
	return l, err
}

func (r *LocationRepository) Create(ctx context.Context, req LocationCreate) (Location, error) {
	tz := req.Timezone
	if tz == "" {
		tz = "Europe/Vilnius"
	}
	row := r.db.QueryRow(ctx, `
		INSERT INTO locations (business_id, name, address, city, country, phone, email, lat, lng, timezone)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id, business_id, name, address, city, country, phone, email, lat, lng, timezone, is_active, created_at, updated_at
	`, req.BusinessID, req.Name, req.Address, req.City, req.Country,
		req.Phone, req.Email, req.Lat, req.Lng, tz)
	return scanLocation(row)
}

func (r *LocationRepository) GetByID(ctx context.Context, id uuid.UUID) (Location, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, business_id, name, address, city, country, phone, email, lat, lng, timezone, is_active, created_at, updated_at
		FROM locations WHERE id = $1
	`, id)
	l, err := scanLocation(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Location{}, ErrLocationNotFound
	}
	return l, err
}

func (r *LocationRepository) ListByBusinessID(ctx context.Context, businessID uuid.UUID, page, perPage int) ([]Location, int, error) {
	offset := (page - 1) * perPage
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM locations WHERE business_id = $1`, businessID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, business_id, name, address, city, country, phone, email, lat, lng, timezone, is_active, created_at, updated_at
		FROM locations WHERE business_id = $1
		ORDER BY created_at ASC
		LIMIT $2 OFFSET $3
	`, businessID, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var locations []Location
	for rows.Next() {
		l, err := scanLocation(rows)
		if err != nil {
			return nil, 0, err
		}
		locations = append(locations, l)
	}
	if locations == nil {
		locations = []Location{}
	}
	return locations, total, rows.Err()
}

func (r *LocationRepository) Update(ctx context.Context, id uuid.UUID, req LocationUpdate) (Location, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE locations SET
			name      = COALESCE($2, name),
			address   = COALESCE($3, address),
			city      = COALESCE($4, city),
			country   = COALESCE($5, country),
			phone     = COALESCE($6, phone),
			email     = COALESCE($7, email),
			lat       = COALESCE($8, lat),
			lng       = COALESCE($9, lng),
			timezone  = COALESCE($10, timezone),
			is_active = COALESCE($11, is_active),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, business_id, name, address, city, country, phone, email, lat, lng, timezone, is_active, created_at, updated_at
	`, id, req.Name, req.Address, req.City, req.Country, req.Phone, req.Email, req.Lat, req.Lng, req.Timezone, req.IsActive)
	l, err := scanLocation(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Location{}, ErrLocationNotFound
	}
	return l, err
}

func (r *LocationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM locations WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrLocationNotFound
	}
	return nil
}

// GetOwnerBusinessID returns the business_id for ownership checks.
func (r *LocationRepository) GetOwnerBusinessID(ctx context.Context, locationID uuid.UUID) (uuid.UUID, error) {
	var businessID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT business_id FROM locations WHERE id = $1`, locationID).Scan(&businessID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrLocationNotFound
	}
	return businessID, err
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

// GetOrCreateSchedule returns the schedule for a location, creating it if missing.
func (r *LocationRepository) GetOrCreateSchedule(ctx context.Context, locationID uuid.UUID) (uuid.UUID, error) {
	var schedID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT id FROM schedules WHERE location_id = $1`, locationID).Scan(&schedID)
	if err == nil {
		return schedID, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, err
	}
	// Create with default 7 closed days
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }() //nolint:errcheck

	if err := tx.QueryRow(ctx, `INSERT INTO schedules (location_id) VALUES ($1) RETURNING id`, locationID).Scan(&schedID); err != nil {
		return uuid.Nil, err
	}
	for day := 0; day <= 6; day++ {
		if _, err := tx.Exec(ctx, `INSERT INTO schedule_days (schedule_id, day_of_week, is_open) VALUES ($1,$2,false)`, schedID, day); err != nil {
			return uuid.Nil, err
		}
	}
	return schedID, tx.Commit(ctx)
}

func (r *LocationRepository) GetSchedule(ctx context.Context, locationID uuid.UUID) (Schedule, error) {
	schedID, err := r.GetOrCreateSchedule(ctx, locationID)
	if err != nil {
		return Schedule{}, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, schedule_id, day_of_week, is_open, open_time::text, close_time::text
		FROM schedule_days WHERE schedule_id = $1 ORDER BY day_of_week
	`, schedID)
	if err != nil {
		return Schedule{}, err
	}
	defer rows.Close()

	var days []ScheduleDay
	for rows.Next() {
		var d ScheduleDay
		if err := rows.Scan(&d.ID, &d.ScheduleID, &d.DayOfWeek, &d.IsOpen, &d.OpenTime, &d.CloseTime); err != nil {
			return Schedule{}, err
		}
		days = append(days, d)
	}
	if err := rows.Err(); err != nil {
		return Schedule{}, err
	}

	exceptions, err := r.listExceptions(ctx, schedID)
	if err != nil {
		return Schedule{}, err
	}

	return Schedule{ID: schedID, LocationID: locationID, Days: days, Exceptions: exceptions}, nil
}

func (r *LocationRepository) UpsertScheduleDays(ctx context.Context, locationID uuid.UUID, inputs []ScheduleDayInput) (Schedule, error) {
	schedID, err := r.GetOrCreateSchedule(ctx, locationID)
	if err != nil {
		return Schedule{}, err
	}
	for _, d := range inputs {
		if _, err := r.db.Exec(ctx, `
			INSERT INTO schedule_days (schedule_id, day_of_week, is_open, open_time, close_time)
			VALUES ($1,$2,$3,$4::time,$5::time)
			ON CONFLICT (schedule_id, day_of_week) DO UPDATE SET
				is_open = EXCLUDED.is_open,
				open_time = EXCLUDED.open_time,
				close_time = EXCLUDED.close_time
		`, schedID, d.DayOfWeek, d.IsOpen, d.OpenTime, d.CloseTime); err != nil {
			return Schedule{}, fmt.Errorf("upsert day %d: %w", d.DayOfWeek, err)
		}
	}
	if _, err := r.db.Exec(ctx, `UPDATE schedules SET updated_at=NOW() WHERE id=$1`, schedID); err != nil {
		return Schedule{}, err
	}
	return r.GetSchedule(ctx, locationID)
}

func (r *LocationRepository) listExceptions(ctx context.Context, schedID uuid.UUID) ([]ScheduleException, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, schedule_id, date::text, is_closed, open_time::text, close_time::text, reason, created_at
		FROM schedule_exceptions WHERE schedule_id = $1 AND date >= CURRENT_DATE ORDER BY date
	`, schedID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var exceptions []ScheduleException
	for rows.Next() {
		var e ScheduleException
		if err := rows.Scan(&e.ID, &e.ScheduleID, &e.Date, &e.IsClosed, &e.OpenTime, &e.CloseTime, &e.Reason, &e.CreatedAt); err != nil {
			return nil, err
		}
		exceptions = append(exceptions, e)
	}
	if exceptions == nil {
		exceptions = []ScheduleException{}
	}
	return exceptions, rows.Err()
}

func (r *LocationRepository) ListExceptions(ctx context.Context, locationID uuid.UUID) ([]ScheduleException, error) {
	schedID, err := r.GetOrCreateSchedule(ctx, locationID)
	if err != nil {
		return nil, err
	}
	return r.listExceptions(ctx, schedID)
}

func (r *LocationRepository) CreateException(ctx context.Context, locationID uuid.UUID, req ScheduleExceptionCreate) (ScheduleException, error) {
	schedID, err := r.GetOrCreateSchedule(ctx, locationID)
	if err != nil {
		return ScheduleException{}, err
	}
	var e ScheduleException
	err = r.db.QueryRow(ctx, `
		INSERT INTO schedule_exceptions (schedule_id, date, is_closed, open_time, close_time, reason)
		VALUES ($1, $2::date, $3, $4::time, $5::time, $6)
		ON CONFLICT (schedule_id, date) DO UPDATE SET
			is_closed = EXCLUDED.is_closed,
			open_time = EXCLUDED.open_time,
			close_time = EXCLUDED.close_time,
			reason = EXCLUDED.reason
		RETURNING id, schedule_id, date::text, is_closed, open_time::text, close_time::text, reason, created_at
	`, schedID, req.Date, req.IsClosed, req.OpenTime, req.CloseTime, req.Reason).Scan(
		&e.ID, &e.ScheduleID, &e.Date, &e.IsClosed, &e.OpenTime, &e.CloseTime, &e.Reason, &e.CreatedAt,
	)
	if err != nil {
		return ScheduleException{}, err
	}
	e.LocationID = locationID
	return e, nil
}

func (r *LocationRepository) DeleteException(ctx context.Context, exceptionID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM schedule_exceptions WHERE id = $1`, exceptionID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrLocationNotFound
	}
	return nil
}

// ─── Photos ───────────────────────────────────────────────────────────────────

func (r *LocationRepository) ListPhotos(ctx context.Context, locationID uuid.UUID) ([]LocationPhoto, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, location_id, url, display_order, created_at
		FROM location_photos WHERE location_id = $1 ORDER BY display_order, created_at
	`, locationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var photos []LocationPhoto
	for rows.Next() {
		var p LocationPhoto
		if err := rows.Scan(&p.ID, &p.LocationID, &p.URL, &p.DisplayOrder, &p.CreatedAt); err != nil {
			return nil, err
		}
		photos = append(photos, p)
	}
	if photos == nil {
		photos = []LocationPhoto{}
	}
	return photos, rows.Err()
}

func (r *LocationRepository) CreatePhoto(ctx context.Context, locationID uuid.UUID, url string) (LocationPhoto, error) {
	var p LocationPhoto
	err := r.db.QueryRow(ctx, `
		INSERT INTO location_photos (location_id, url, display_order)
		VALUES ($1, $2, (SELECT COALESCE(MAX(display_order)+1, 0) FROM location_photos WHERE location_id = $1))
		RETURNING id, location_id, url, display_order, created_at
	`, locationID, url).Scan(&p.ID, &p.LocationID, &p.URL, &p.DisplayOrder, &p.CreatedAt)
	return p, err
}

func (r *LocationRepository) DeletePhoto(ctx context.Context, photoID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM location_photos WHERE id = $1`, photoID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrLocationNotFound
	}
	return nil
}

func (r *LocationRepository) GetPhotoOwnerLocationID(ctx context.Context, photoID uuid.UUID) (uuid.UUID, error) {
	var locationID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT location_id FROM location_photos WHERE id = $1`, photoID).Scan(&locationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrLocationNotFound
	}
	return locationID, err
}
