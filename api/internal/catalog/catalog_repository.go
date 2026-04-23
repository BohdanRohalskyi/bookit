package catalog

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CatalogRepository handles equipment, staff roles, services and location pivots.
type CatalogRepository struct {
	db *pgxpool.Pool
}

func NewCatalogRepository(db *pgxpool.Pool) *CatalogRepository {
	return &CatalogRepository{db: db}
}

// ─── Equipment ────────────────────────────────────────────────────────────────

func (r *CatalogRepository) CreateEquipment(ctx context.Context, req EquipmentCreate) (Equipment, error) {
	var e Equipment
	err := r.db.QueryRow(ctx, `
		INSERT INTO equipment (business_id, name) VALUES ($1, $2)
		RETURNING id, uuid, business_id, name, created_at
	`, req.BusinessID, req.Name).Scan(&e.ID, &e.UUID, &e.BusinessID, &e.Name, &e.CreatedAt)
	return e, err
}

func (r *CatalogRepository) ListEquipmentByBusiness(ctx context.Context, businessID int64) ([]Equipment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, uuid, business_id, name, created_at FROM equipment
		WHERE business_id = $1 ORDER BY name
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Equipment
	for rows.Next() {
		var e Equipment
		if err := rows.Scan(&e.ID, &e.UUID, &e.BusinessID, &e.Name, &e.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	if items == nil {
		items = []Equipment{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) DeleteEquipment(ctx context.Context, id int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM equipment WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrEquipmentNotFound
	}
	return nil
}

func (r *CatalogRepository) GetEquipmentBusinessID(ctx context.Context, id int64) (int64, error) {
	var bID int64
	err := r.db.QueryRow(ctx, `SELECT business_id FROM equipment WHERE id = $1`, id).Scan(&bID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrEquipmentNotFound
	}
	return bID, err
}

// ─── Staff roles ──────────────────────────────────────────────────────────────

func (r *CatalogRepository) CreateStaffRole(ctx context.Context, req StaffRoleCreate) (StaffRole, error) {
	var s StaffRole
	err := r.db.QueryRow(ctx, `
		WITH ins AS (
			INSERT INTO staff_roles (business_id, job_title, role_id, is_system)
			VALUES ($1, $2, $3, $4)
			RETURNING id, uuid, business_id, role_id, job_title, is_system, created_at
		)
		SELECT ins.id, ins.uuid, ins.business_id, b.uuid, ins.role_id, ro.slug,
		       ins.job_title, ins.is_system, ins.created_at
		FROM ins
		JOIN roles      ro ON ro.id = ins.role_id
		JOIN businesses  b ON  b.id = ins.business_id
	`, req.BusinessID, req.JobTitle, req.RoleID, req.IsSystem).Scan(
		&s.ID, &s.UUID, &s.BusinessID, &s.BusinessUUID, &s.RoleID, &s.RoleSlug,
		&s.JobTitle, &s.IsSystem, &s.CreatedAt,
	)
	return s, err
}

func (r *CatalogRepository) ListStaffRolesByBusiness(ctx context.Context, businessID int64) ([]StaffRole, error) {
	rows, err := r.db.Query(ctx, `
		SELECT sr.id, sr.uuid, sr.business_id, b.uuid, sr.role_id, ro.slug,
		       sr.job_title, sr.is_system, sr.created_at
		FROM staff_roles sr
		JOIN roles      ro ON ro.id = sr.role_id
		JOIN businesses  b ON  b.id = sr.business_id
		WHERE sr.business_id = $1
		ORDER BY sr.is_system DESC, sr.job_title
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []StaffRole
	for rows.Next() {
		var s StaffRole
		if err := rows.Scan(&s.ID, &s.UUID, &s.BusinessID, &s.BusinessUUID, &s.RoleID, &s.RoleSlug,
			&s.JobTitle, &s.IsSystem, &s.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	if items == nil {
		items = []StaffRole{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) DeleteStaffRole(ctx context.Context, id int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM staff_roles WHERE id = $1 AND is_system = false`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		// Distinguish "not found" from "protected"
		var isSystem bool
		scanErr := r.db.QueryRow(ctx, `SELECT is_system FROM staff_roles WHERE id = $1`, id).Scan(&isSystem)
		if errors.Is(scanErr, pgx.ErrNoRows) {
			return ErrStaffRoleNotFound
		}
		return ErrStaffRoleProtected
	}
	return nil
}

func (r *CatalogRepository) GetRoleIDBySlug(ctx context.Context, slug string) (int64, error) {
	var id int64
	err := r.db.QueryRow(ctx,
		`SELECT id FROM roles WHERE slug = $1 AND is_system = true LIMIT 1`, slug,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrStaffRoleNotFound
	}
	return id, err
}

func (r *CatalogRepository) GetStaffRoleBusinessID(ctx context.Context, id int64) (int64, error) {
	var bID int64
	err := r.db.QueryRow(ctx, `SELECT business_id FROM staff_roles WHERE id = $1`, id).Scan(&bID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrStaffRoleNotFound
	}
	return bID, err
}

// ─── Services ─────────────────────────────────────────────────────────────────

func (r *CatalogRepository) CreateService(ctx context.Context, req ServiceItemCreate) (ServiceItem, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return ServiceItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }() //nolint:errcheck

	var svc ServiceItem
	if err := tx.QueryRow(ctx, `
		INSERT INTO services (business_id, name, description, duration_minutes, price, currency)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, uuid, business_id, name, description, duration_minutes, price, currency, created_at, updated_at
	`, req.BusinessID, req.Name, req.Description, req.DurationMinutes, req.Price, req.Currency).Scan(
		&svc.ID, &svc.UUID, &svc.BusinessID, &svc.Name, &svc.Description,
		&svc.DurationMinutes, &svc.Price, &svc.Currency, &svc.CreatedAt, &svc.UpdatedAt,
	); err != nil {
		return ServiceItem{}, err
	}

	for _, e := range req.EquipmentReqs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO service_equipment_requirements (service_id, equipment_id, quantity_needed)
			VALUES ($1,$2,$3)
		`, svc.ID, e.EquipmentID, e.QuantityNeeded); err != nil {
			return ServiceItem{}, fmt.Errorf("equipment req: %w", err)
		}
	}

	for _, s := range req.StaffReqs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO service_staff_requirements (service_id, staff_role_id, quantity_needed)
			VALUES ($1,$2,$3)
		`, svc.ID, s.StaffRoleID, s.QuantityNeeded); err != nil {
			return ServiceItem{}, fmt.Errorf("staff req: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ServiceItem{}, err
	}
	return r.getServiceWithRequirements(ctx, svc.ID)
}

func (r *CatalogRepository) getServiceWithRequirements(ctx context.Context, id int64) (ServiceItem, error) {
	var svc ServiceItem
	err := r.db.QueryRow(ctx, `
		SELECT id, uuid, business_id, name, description, duration_minutes, price, currency, created_at, updated_at
		FROM services WHERE id = $1
	`, id).Scan(&svc.ID, &svc.UUID, &svc.BusinessID, &svc.Name, &svc.Description,
		&svc.DurationMinutes, &svc.Price, &svc.Currency, &svc.CreatedAt, &svc.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ServiceItem{}, ErrServiceNotFound
	}
	if err != nil {
		return ServiceItem{}, err
	}

	// Equipment requirements
	eRows, err := r.db.Query(ctx, `
		SELECT ser.equipment_id, e.uuid, e.name, ser.quantity_needed
		FROM service_equipment_requirements ser
		JOIN equipment e ON e.id = ser.equipment_id
		WHERE ser.service_id = $1
	`, id)
	if err != nil {
		return ServiceItem{}, err
	}
	defer eRows.Close()
	for eRows.Next() {
		var req ServiceEquipmentReq
		if err := eRows.Scan(&req.EquipmentID, &req.EquipmentUUID, &req.EquipmentName, &req.QuantityNeeded); err != nil {
			return ServiceItem{}, err
		}
		svc.Equipment = append(svc.Equipment, req)
	}
	if svc.Equipment == nil {
		svc.Equipment = []ServiceEquipmentReq{}
	}

	// Staff requirements
	sRows, err := r.db.Query(ctx, `
		SELECT ssr.staff_role_id, sr.uuid, sr.job_title, ssr.quantity_needed
		FROM service_staff_requirements ssr
		JOIN staff_roles sr ON sr.id = ssr.staff_role_id
		WHERE ssr.service_id = $1
	`, id)
	if err != nil {
		return ServiceItem{}, err
	}
	defer sRows.Close()
	for sRows.Next() {
		var req ServiceStaffReq
		if err := sRows.Scan(&req.StaffRoleID, &req.StaffRoleUUID, &req.JobTitle, &req.QuantityNeeded); err != nil {
			return ServiceItem{}, err
		}
		svc.Staff = append(svc.Staff, req)
	}
	if svc.Staff == nil {
		svc.Staff = []ServiceStaffReq{}
	}

	return svc, nil
}

func (r *CatalogRepository) ListServicesByBusiness(ctx context.Context, businessID int64) ([]ServiceItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id FROM services WHERE business_id = $1 ORDER BY name
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	var services []ServiceItem
	for _, id := range ids {
		svc, err := r.getServiceWithRequirements(ctx, id)
		if err != nil {
			return nil, err
		}
		services = append(services, svc)
	}
	if services == nil {
		services = []ServiceItem{}
	}
	return services, nil
}

func (r *CatalogRepository) SearchServices(ctx context.Context, p ServiceSearchParams) ([]ServiceSearchResultItem, int, error) {
	var clauses []string
	var args []any

	clauses = append(clauses, "b.is_active = true")

	if p.Q != nil && *p.Q != "" {
		args = append(args, "%"+*p.Q+"%")
		n := len(args)
		clauses = append(clauses, fmt.Sprintf("(s.name ILIKE $%d OR s.description ILIKE $%d)", n, n))
	}
	if p.Category != nil && *p.Category != "" {
		args = append(args, *p.Category)
		clauses = append(clauses, fmt.Sprintf("b.category = $%d", len(args)))
	}
	if p.City != nil && *p.City != "" {
		args = append(args, "%"+*p.City+"%")
		clauses = append(clauses, fmt.Sprintf("l.city ILIKE $%d", len(args)))
	}

	where := "WHERE " + strings.Join(clauses, " AND ")

	base := `
		FROM services s
		JOIN businesses b ON b.id = s.business_id
		LEFT JOIN location_services ls ON ls.service_id = s.id AND ls.is_active = true
		LEFT JOIN locations l ON l.id = ls.location_id AND l.is_active = true
		` + where

	var total int
	if err := r.db.QueryRow(ctx, "SELECT COUNT(DISTINCT s.id)"+base, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (p.Page - 1) * p.PerPage
	dataArgs := append(args, p.PerPage, offset)
	nLimit := len(dataArgs) - 1
	nOffset := len(dataArgs)

	query := fmt.Sprintf(`
		SELECT
			s.uuid, s.name, s.description, s.duration_minutes, s.price::float8, s.currency,
			b.uuid, b.name, b.category, b.logo_url,
			MIN(l.city) AS city
		%s
		GROUP BY s.uuid, s.name, s.description, s.duration_minutes, s.price, s.currency,
		         b.uuid, b.name, b.category, b.logo_url
		ORDER BY s.name
		LIMIT $%d OFFSET $%d
	`, base, nLimit, nOffset)

	rows, err := r.db.Query(ctx, query, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []ServiceSearchResultItem
	for rows.Next() {
		var item ServiceSearchResultItem
		if err := rows.Scan(
			&item.UUID, &item.Name, &item.Description, &item.DurationMinutes, &item.Price, &item.Currency,
			&item.BusinessUUID, &item.BusinessName, &item.Category, &item.CoverImageURL,
			&item.City,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if items == nil {
		items = []ServiceSearchResultItem{}
	}
	return items, total, rows.Err()
}

func (r *CatalogRepository) GetServiceDetail(ctx context.Context, serviceUUID uuid.UUID) (ServiceDetail, error) {
	var d ServiceDetail
	err := r.db.QueryRow(ctx, `
		SELECT
			s.uuid, s.name, s.description, s.duration_minutes, s.price::float8, s.currency,
			b.uuid, b.name, b.category, b.logo_url,
			MIN(l.city) AS city,
			s.created_at
		FROM services s
		JOIN businesses b ON b.id = s.business_id AND b.is_active = true
		LEFT JOIN location_services ls ON ls.service_id = s.id AND ls.is_active = true
		LEFT JOIN locations l ON l.id = ls.location_id AND l.is_active = true
		WHERE s.uuid = $1
		GROUP BY s.uuid, s.name, s.description, s.duration_minutes, s.price, s.currency,
		         b.uuid, b.name, b.category, b.logo_url, s.created_at
	`, serviceUUID).Scan(
		&d.UUID, &d.Name, &d.Description, &d.DurationMinutes, &d.Price, &d.Currency,
		&d.BusinessUUID, &d.BusinessName, &d.Category, &d.CoverImageURL,
		&d.City, &d.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return ServiceDetail{}, ErrServiceNotFound
	}
	return d, err
}

func (r *CatalogRepository) DeleteService(ctx context.Context, id int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM services WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrServiceNotFound
	}
	return nil
}

func (r *CatalogRepository) GetServiceBusinessID(ctx context.Context, id int64) (int64, error) {
	var bID int64
	err := r.db.QueryRow(ctx, `SELECT business_id FROM services WHERE id = $1`, id).Scan(&bID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrServiceNotFound
	}
	return bID, err
}

// ─── Location equipment pivot ─────────────────────────────────────────────────

func (r *CatalogRepository) AddLocationEquipment(ctx context.Context, locationID int64, req LocationEquipmentCreate) (LocationEquipment, error) {
	var le LocationEquipment
	err := r.db.QueryRow(ctx, `
		INSERT INTO location_equipment (location_id, equipment_id, quantity)
		VALUES ($1,$2,$3)
		ON CONFLICT (location_id, equipment_id) DO UPDATE SET quantity = EXCLUDED.quantity
		RETURNING id, uuid, location_id, equipment_id, quantity
	`, locationID, req.EquipmentID, req.Quantity).Scan(&le.ID, &le.UUID, &le.LocationID, &le.EquipmentID, &le.Quantity)
	if err != nil {
		return LocationEquipment{}, err
	}
	_ = r.db.QueryRow(ctx, `SELECT uuid, name FROM equipment WHERE id = $1`, req.EquipmentID).Scan(&le.EquipmentUUID, &le.EquipmentName) //nolint:errcheck // best-effort name denorm
	return le, nil
}

func (r *CatalogRepository) ListLocationEquipment(ctx context.Context, locationID int64) ([]LocationEquipment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT le.id, le.uuid, le.location_id, le.equipment_id, e.uuid, e.name, le.quantity
		FROM location_equipment le
		JOIN equipment e ON e.id = le.equipment_id
		WHERE le.location_id = $1 ORDER BY e.name
	`, locationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []LocationEquipment
	for rows.Next() {
		var le LocationEquipment
		if err := rows.Scan(&le.ID, &le.UUID, &le.LocationID, &le.EquipmentID, &le.EquipmentUUID, &le.EquipmentName, &le.Quantity); err != nil {
			return nil, err
		}
		items = append(items, le)
	}
	if items == nil {
		items = []LocationEquipment{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) RemoveLocationEquipment(ctx context.Context, itemID int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM location_equipment WHERE id = $1`, itemID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrLocationItemNotFound
	}
	return nil
}

func (r *CatalogRepository) GetLocationEquipmentLocationID(ctx context.Context, itemID int64) (int64, error) {
	var lID int64
	err := r.db.QueryRow(ctx, `SELECT location_id FROM location_equipment WHERE id = $1`, itemID).Scan(&lID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrLocationItemNotFound
	}
	return lID, err
}

// ─── Location staff roles pivot ───────────────────────────────────────────────

func (r *CatalogRepository) AddLocationStaffRole(ctx context.Context, locationID int64, req LocationStaffRoleCreate) (LocationStaffRole, error) {
	var ls LocationStaffRole
	err := r.db.QueryRow(ctx, `
		INSERT INTO location_staff_roles (location_id, staff_role_id, quantity)
		VALUES ($1,$2,$3)
		ON CONFLICT (location_id, staff_role_id) DO UPDATE SET quantity = EXCLUDED.quantity
		RETURNING id, uuid, location_id, staff_role_id, quantity
	`, locationID, req.StaffRoleID, req.Quantity).Scan(&ls.ID, &ls.UUID, &ls.LocationID, &ls.StaffRoleID, &ls.Quantity)
	if err != nil {
		return LocationStaffRole{}, err
	}
	_ = r.db.QueryRow(ctx, `SELECT uuid, job_title FROM staff_roles WHERE id = $1`, req.StaffRoleID).Scan(&ls.StaffRoleUUID, &ls.JobTitle) //nolint:errcheck // best-effort name denorm
	return ls, nil
}

func (r *CatalogRepository) ListLocationStaffRoles(ctx context.Context, locationID int64) ([]LocationStaffRole, error) {
	rows, err := r.db.Query(ctx, `
		SELECT ls.id, ls.uuid, ls.location_id, ls.staff_role_id, sr.uuid, sr.job_title, ls.quantity
		FROM location_staff_roles ls
		JOIN staff_roles sr ON sr.id = ls.staff_role_id
		WHERE ls.location_id = $1 ORDER BY sr.job_title
	`, locationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []LocationStaffRole
	for rows.Next() {
		var ls LocationStaffRole
		if err := rows.Scan(&ls.ID, &ls.UUID, &ls.LocationID, &ls.StaffRoleID, &ls.StaffRoleUUID, &ls.JobTitle, &ls.Quantity); err != nil {
			return nil, err
		}
		items = append(items, ls)
	}
	if items == nil {
		items = []LocationStaffRole{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) RemoveLocationStaffRole(ctx context.Context, itemID int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM location_staff_roles WHERE id = $1`, itemID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrLocationItemNotFound
	}
	return nil
}

func (r *CatalogRepository) GetLocationStaffRoleLocationID(ctx context.Context, itemID int64) (int64, error) {
	var lID int64
	err := r.db.QueryRow(ctx, `SELECT location_id FROM location_staff_roles WHERE id = $1`, itemID).Scan(&lID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrLocationItemNotFound
	}
	return lID, err
}

// ─── Location services pivot ──────────────────────────────────────────────────

func (r *CatalogRepository) AddLocationService(ctx context.Context, locationID int64, req LocationServiceItemCreate) (LocationServiceItem, error) {
	var ls LocationServiceItem
	err := r.db.QueryRow(ctx, `
		INSERT INTO location_services (location_id, service_id)
		VALUES ($1,$2)
		ON CONFLICT (location_id, service_id) DO UPDATE SET is_active = true
		RETURNING id, uuid, location_id, service_id, is_active
	`, locationID, req.ServiceID).Scan(&ls.ID, &ls.UUID, &ls.LocationID, &ls.ServiceID, &ls.IsActive)
	if err != nil {
		return LocationServiceItem{}, err
	}
	svc, err := r.getServiceWithRequirements(ctx, req.ServiceID)
	if err == nil {
		ls.ServiceItem = svc
	}
	return ls, nil
}

func (r *CatalogRepository) ListLocationServices(ctx context.Context, locationID int64) ([]LocationServiceItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, uuid, location_id, service_id, is_active FROM location_services
		WHERE location_id = $1
	`, locationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []LocationServiceItem
	for rows.Next() {
		var ls LocationServiceItem
		if err := rows.Scan(&ls.ID, &ls.UUID, &ls.LocationID, &ls.ServiceID, &ls.IsActive); err != nil {
			return nil, err
		}
		svc, err := r.getServiceWithRequirements(ctx, ls.ServiceID)
		if err == nil {
			ls.ServiceItem = svc
		}
		items = append(items, ls)
	}
	if items == nil {
		items = []LocationServiceItem{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) RemoveLocationService(ctx context.Context, itemID int64) error {
	res, err := r.db.Exec(ctx, `DELETE FROM location_services WHERE id = $1`, itemID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrLocationItemNotFound
	}
	return nil
}

func (r *CatalogRepository) GetLocationServiceLocationID(ctx context.Context, itemID int64) (int64, error) {
	var lID int64
	err := r.db.QueryRow(ctx, `SELECT location_id FROM location_services WHERE id = $1`, itemID).Scan(&lID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrLocationItemNotFound
	}
	return lID, err
}
