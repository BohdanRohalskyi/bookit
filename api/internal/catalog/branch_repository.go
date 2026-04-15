package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BranchRepository struct {
	db *pgxpool.Pool
}

func NewBranchRepository(db *pgxpool.Pool) *BranchRepository {
	return &BranchRepository{db: db}
}

func scanBranch(row pgx.Row) (Branch, error) {
	var b Branch
	err := row.Scan(
		&b.ID, &b.BusinessID, &b.Name, &b.Address, &b.City, &b.Country,
		&b.Phone, &b.Email, &b.Lat, &b.Lng, &b.Timezone, &b.IsActive,
		&b.CreatedAt, &b.UpdatedAt,
	)
	return b, err
}

func (r *BranchRepository) Create(ctx context.Context, req BranchCreate) (Branch, error) {
	tz := req.Timezone
	if tz == "" {
		tz = "Europe/Vilnius"
	}
	row := r.db.QueryRow(ctx, `
		INSERT INTO branches (business_id, name, address, city, country, phone, email, lat, lng, timezone)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id, business_id, name, address, city, country, phone, email, lat, lng, timezone, is_active, created_at, updated_at
	`, req.BusinessID, req.Name, req.Address, req.City, req.Country,
		req.Phone, req.Email, req.Lat, req.Lng, tz)
	return scanBranch(row)
}

func (r *BranchRepository) GetByID(ctx context.Context, id uuid.UUID) (Branch, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, business_id, name, address, city, country, phone, email, lat, lng, timezone, is_active, created_at, updated_at
		FROM branches WHERE id = $1
	`, id)
	b, err := scanBranch(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Branch{}, ErrBranchNotFound
	}
	return b, err
}

func (r *BranchRepository) ListByBusinessID(ctx context.Context, businessID uuid.UUID, page, perPage int) ([]Branch, int, error) {
	offset := (page - 1) * perPage
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM branches WHERE business_id = $1`, businessID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, business_id, name, address, city, country, phone, email, lat, lng, timezone, is_active, created_at, updated_at
		FROM branches WHERE business_id = $1
		ORDER BY created_at ASC
		LIMIT $2 OFFSET $3
	`, businessID, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var branches []Branch
	for rows.Next() {
		b, err := scanBranch(rows)
		if err != nil {
			return nil, 0, err
		}
		branches = append(branches, b)
	}
	if branches == nil {
		branches = []Branch{}
	}
	return branches, total, rows.Err()
}

func (r *BranchRepository) Update(ctx context.Context, id uuid.UUID, req BranchUpdate) (Branch, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE branches SET
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
	b, err := scanBranch(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Branch{}, ErrBranchNotFound
	}
	return b, err
}

func (r *BranchRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM branches WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrBranchNotFound
	}
	return nil
}

// GetOwnerBusinessID returns the business_id for ownership checks.
func (r *BranchRepository) GetOwnerBusinessID(ctx context.Context, branchID uuid.UUID) (uuid.UUID, error) {
	var businessID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT business_id FROM branches WHERE id = $1`, branchID).Scan(&businessID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrBranchNotFound
	}
	return businessID, err
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

// GetOrCreateSchedule returns the schedule for a branch, creating it if missing.
func (r *BranchRepository) GetOrCreateSchedule(ctx context.Context, branchID uuid.UUID) (uuid.UUID, error) {
	var schedID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT id FROM schedules WHERE branch_id = $1`, branchID).Scan(&schedID)
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

	if err := tx.QueryRow(ctx, `INSERT INTO schedules (branch_id) VALUES ($1) RETURNING id`, branchID).Scan(&schedID); err != nil {
		return uuid.Nil, err
	}
	for day := 0; day <= 6; day++ {
		if _, err := tx.Exec(ctx, `INSERT INTO schedule_days (schedule_id, day_of_week, is_open) VALUES ($1,$2,false)`, schedID, day); err != nil {
			return uuid.Nil, err
		}
	}
	return schedID, tx.Commit(ctx)
}

func (r *BranchRepository) GetSchedule(ctx context.Context, branchID uuid.UUID) (Schedule, error) {
	schedID, err := r.GetOrCreateSchedule(ctx, branchID)
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

	return Schedule{ID: schedID, BranchID: branchID, Days: days, Exceptions: exceptions}, nil
}

func (r *BranchRepository) UpsertScheduleDays(ctx context.Context, branchID uuid.UUID, inputs []ScheduleDayInput) (Schedule, error) {
	schedID, err := r.GetOrCreateSchedule(ctx, branchID)
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
	return r.GetSchedule(ctx, branchID)
}

func (r *BranchRepository) listExceptions(ctx context.Context, schedID uuid.UUID) ([]ScheduleException, error) {
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

func (r *BranchRepository) ListExceptions(ctx context.Context, branchID uuid.UUID) ([]ScheduleException, error) {
	schedID, err := r.GetOrCreateSchedule(ctx, branchID)
	if err != nil {
		return nil, err
	}
	return r.listExceptions(ctx, schedID)
}

func (r *BranchRepository) CreateException(ctx context.Context, branchID uuid.UUID, req ScheduleExceptionCreate) (ScheduleException, error) {
	schedID, err := r.GetOrCreateSchedule(ctx, branchID)
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
	e.BranchID = branchID
	return e, nil
}

func (r *BranchRepository) DeleteException(ctx context.Context, exceptionID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM schedule_exceptions WHERE id = $1`, exceptionID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrBranchNotFound
	}
	return nil
}

// ─── Photos ───────────────────────────────────────────────────────────────────

func (r *BranchRepository) ListPhotos(ctx context.Context, branchID uuid.UUID) ([]BranchPhoto, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, branch_id, url, display_order, created_at
		FROM branch_photos WHERE branch_id = $1 ORDER BY display_order, created_at
	`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var photos []BranchPhoto
	for rows.Next() {
		var p BranchPhoto
		if err := rows.Scan(&p.ID, &p.BranchID, &p.URL, &p.DisplayOrder, &p.CreatedAt); err != nil {
			return nil, err
		}
		photos = append(photos, p)
	}
	if photos == nil {
		photos = []BranchPhoto{}
	}
	return photos, rows.Err()
}

func (r *BranchRepository) CreatePhoto(ctx context.Context, branchID uuid.UUID, url string) (BranchPhoto, error) {
	var p BranchPhoto
	err := r.db.QueryRow(ctx, `
		INSERT INTO branch_photos (branch_id, url, display_order)
		VALUES ($1, $2, (SELECT COALESCE(MAX(display_order)+1, 0) FROM branch_photos WHERE branch_id = $1))
		RETURNING id, branch_id, url, display_order, created_at
	`, branchID, url).Scan(&p.ID, &p.BranchID, &p.URL, &p.DisplayOrder, &p.CreatedAt)
	return p, err
}

func (r *BranchRepository) DeletePhoto(ctx context.Context, photoID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM branch_photos WHERE id = $1`, photoID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrBranchNotFound
	}
	return nil

}

func (r *BranchRepository) GetPhotoOwnerBranchID(ctx context.Context, photoID uuid.UUID) (uuid.UUID, error) {
	var branchID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT branch_id FROM branch_photos WHERE id = $1`, photoID).Scan(&branchID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrBranchNotFound
	}
	return branchID, err
}
