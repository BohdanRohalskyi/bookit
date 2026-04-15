package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CatalogRepository handles equipment, staff roles, services and branch pivots.
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
		RETURNING id, business_id, name, created_at
	`, req.BusinessID, req.Name).Scan(&e.ID, &e.BusinessID, &e.Name, &e.CreatedAt)
	return e, err
}

func (r *CatalogRepository) ListEquipmentByBusiness(ctx context.Context, businessID uuid.UUID) ([]Equipment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, business_id, name, created_at FROM equipment
		WHERE business_id = $1 ORDER BY name
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Equipment
	for rows.Next() {
		var e Equipment
		if err := rows.Scan(&e.ID, &e.BusinessID, &e.Name, &e.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	if items == nil {
		items = []Equipment{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) DeleteEquipment(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.Exec(ctx, `DELETE FROM equipment WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrEquipmentNotFound
	}
	return nil
}

func (r *CatalogRepository) GetEquipmentBusinessID(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	var bID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT business_id FROM equipment WHERE id = $1`, id).Scan(&bID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrEquipmentNotFound
	}
	return bID, err
}

// ─── Staff roles ──────────────────────────────────────────────────────────────

func (r *CatalogRepository) CreateStaffRole(ctx context.Context, req StaffRoleCreate) (StaffRole, error) {
	var s StaffRole
	err := r.db.QueryRow(ctx, `
		INSERT INTO staff_roles (business_id, job_title) VALUES ($1, $2)
		RETURNING id, business_id, job_title, created_at
	`, req.BusinessID, req.JobTitle).Scan(&s.ID, &s.BusinessID, &s.JobTitle, &s.CreatedAt)
	return s, err
}

func (r *CatalogRepository) ListStaffRolesByBusiness(ctx context.Context, businessID uuid.UUID) ([]StaffRole, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, business_id, job_title, created_at FROM staff_roles
		WHERE business_id = $1 ORDER BY job_title
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []StaffRole
	for rows.Next() {
		var s StaffRole
		if err := rows.Scan(&s.ID, &s.BusinessID, &s.JobTitle, &s.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	if items == nil {
		items = []StaffRole{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) DeleteStaffRole(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.Exec(ctx, `DELETE FROM staff_roles WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrStaffRoleNotFound
	}
	return nil
}

func (r *CatalogRepository) GetStaffRoleBusinessID(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	var bID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT business_id FROM staff_roles WHERE id = $1`, id).Scan(&bID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrStaffRoleNotFound
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
		RETURNING id, business_id, name, description, duration_minutes, price, currency, created_at, updated_at
	`, req.BusinessID, req.Name, req.Description, req.DurationMinutes, req.Price, req.Currency).Scan(
		&svc.ID, &svc.BusinessID, &svc.Name, &svc.Description,
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

func (r *CatalogRepository) getServiceWithRequirements(ctx context.Context, id uuid.UUID) (ServiceItem, error) {
	var svc ServiceItem
	err := r.db.QueryRow(ctx, `
		SELECT id, business_id, name, description, duration_minutes, price, currency, created_at, updated_at
		FROM services WHERE id = $1
	`, id).Scan(&svc.ID, &svc.BusinessID, &svc.Name, &svc.Description,
		&svc.DurationMinutes, &svc.Price, &svc.Currency, &svc.CreatedAt, &svc.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ServiceItem{}, ErrServiceNotFound
	}
	if err != nil {
		return ServiceItem{}, err
	}

	// Equipment requirements
	eRows, err := r.db.Query(ctx, `
		SELECT ser.equipment_id, e.name, ser.quantity_needed
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
		if err := eRows.Scan(&req.EquipmentID, &req.EquipmentName, &req.QuantityNeeded); err != nil {
			return ServiceItem{}, err
		}
		svc.Equipment = append(svc.Equipment, req)
	}
	if svc.Equipment == nil {
		svc.Equipment = []ServiceEquipmentReq{}
	}

	// Staff requirements
	sRows, err := r.db.Query(ctx, `
		SELECT ssr.staff_role_id, sr.job_title, ssr.quantity_needed
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
		if err := sRows.Scan(&req.StaffRoleID, &req.JobTitle, &req.QuantityNeeded); err != nil {
			return ServiceItem{}, err
		}
		svc.Staff = append(svc.Staff, req)
	}
	if svc.Staff == nil {
		svc.Staff = []ServiceStaffReq{}
	}

	return svc, nil
}

func (r *CatalogRepository) ListServicesByBusiness(ctx context.Context, businessID uuid.UUID) ([]ServiceItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id FROM services WHERE business_id = $1 ORDER BY name
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
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

func (r *CatalogRepository) DeleteService(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.Exec(ctx, `DELETE FROM services WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrServiceNotFound
	}
	return nil
}

func (r *CatalogRepository) GetServiceBusinessID(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	var bID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT business_id FROM services WHERE id = $1`, id).Scan(&bID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrServiceNotFound
	}
	return bID, err
}

// ─── Branch equipment pivot ───────────────────────────────────────────────────

func (r *CatalogRepository) AddBranchEquipment(ctx context.Context, branchID uuid.UUID, req BranchEquipmentCreate) (BranchEquipment, error) {
	var be BranchEquipment
	err := r.db.QueryRow(ctx, `
		INSERT INTO branch_equipment (branch_id, equipment_id, quantity)
		VALUES ($1,$2,$3)
		ON CONFLICT (branch_id, equipment_id) DO UPDATE SET quantity = EXCLUDED.quantity
		RETURNING id, branch_id, equipment_id, quantity
	`, branchID, req.EquipmentID, req.Quantity).Scan(&be.ID, &be.BranchID, &be.EquipmentID, &be.Quantity)
	if err != nil {
		return BranchEquipment{}, err
	}
	_ = r.db.QueryRow(ctx, `SELECT name FROM equipment WHERE id = $1`, req.EquipmentID).Scan(&be.EquipmentName)
	return be, nil
}

func (r *CatalogRepository) ListBranchEquipment(ctx context.Context, branchID uuid.UUID) ([]BranchEquipment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT be.id, be.branch_id, be.equipment_id, e.name, be.quantity
		FROM branch_equipment be
		JOIN equipment e ON e.id = be.equipment_id
		WHERE be.branch_id = $1 ORDER BY e.name
	`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []BranchEquipment
	for rows.Next() {
		var be BranchEquipment
		if err := rows.Scan(&be.ID, &be.BranchID, &be.EquipmentID, &be.EquipmentName, &be.Quantity); err != nil {
			return nil, err
		}
		items = append(items, be)
	}
	if items == nil {
		items = []BranchEquipment{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) RemoveBranchEquipment(ctx context.Context, itemID uuid.UUID) error {
	res, err := r.db.Exec(ctx, `DELETE FROM branch_equipment WHERE id = $1`, itemID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrBranchItemNotFound
	}
	return nil
}

func (r *CatalogRepository) GetBranchEquipmentBranchID(ctx context.Context, itemID uuid.UUID) (uuid.UUID, error) {
	var bID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT branch_id FROM branch_equipment WHERE id = $1`, itemID).Scan(&bID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrBranchItemNotFound
	}
	return bID, err
}

// ─── Branch staff roles pivot ─────────────────────────────────────────────────

func (r *CatalogRepository) AddBranchStaffRole(ctx context.Context, branchID uuid.UUID, req BranchStaffRoleCreate) (BranchStaffRole, error) {
	var bs BranchStaffRole
	err := r.db.QueryRow(ctx, `
		INSERT INTO branch_staff_roles (branch_id, staff_role_id, quantity)
		VALUES ($1,$2,$3)
		ON CONFLICT (branch_id, staff_role_id) DO UPDATE SET quantity = EXCLUDED.quantity
		RETURNING id, branch_id, staff_role_id, quantity
	`, branchID, req.StaffRoleID, req.Quantity).Scan(&bs.ID, &bs.BranchID, &bs.StaffRoleID, &bs.Quantity)
	if err != nil {
		return BranchStaffRole{}, err
	}
	_ = r.db.QueryRow(ctx, `SELECT job_title FROM staff_roles WHERE id = $1`, req.StaffRoleID).Scan(&bs.JobTitle)
	return bs, nil
}

func (r *CatalogRepository) ListBranchStaffRoles(ctx context.Context, branchID uuid.UUID) ([]BranchStaffRole, error) {
	rows, err := r.db.Query(ctx, `
		SELECT bs.id, bs.branch_id, bs.staff_role_id, sr.job_title, bs.quantity
		FROM branch_staff_roles bs
		JOIN staff_roles sr ON sr.id = bs.staff_role_id
		WHERE bs.branch_id = $1 ORDER BY sr.job_title
	`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []BranchStaffRole
	for rows.Next() {
		var bs BranchStaffRole
		if err := rows.Scan(&bs.ID, &bs.BranchID, &bs.StaffRoleID, &bs.JobTitle, &bs.Quantity); err != nil {
			return nil, err
		}
		items = append(items, bs)
	}
	if items == nil {
		items = []BranchStaffRole{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) RemoveBranchStaffRole(ctx context.Context, itemID uuid.UUID) error {
	res, err := r.db.Exec(ctx, `DELETE FROM branch_staff_roles WHERE id = $1`, itemID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrBranchItemNotFound
	}
	return nil
}

func (r *CatalogRepository) GetBranchStaffRoleBranchID(ctx context.Context, itemID uuid.UUID) (uuid.UUID, error) {
	var bID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT branch_id FROM branch_staff_roles WHERE id = $1`, itemID).Scan(&bID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrBranchItemNotFound
	}
	return bID, err
}

// ─── Branch services pivot ────────────────────────────────────────────────────

func (r *CatalogRepository) AddBranchService(ctx context.Context, branchID uuid.UUID, req BranchServiceItemCreate) (BranchServiceItem, error) {
	var bs BranchServiceItem
	err := r.db.QueryRow(ctx, `
		INSERT INTO branch_services (branch_id, service_id)
		VALUES ($1,$2)
		ON CONFLICT (branch_id, service_id) DO UPDATE SET is_active = true
		RETURNING id, branch_id, service_id, is_active
	`, branchID, req.ServiceID).Scan(&bs.ID, &bs.BranchID, &bs.ServiceID, &bs.IsActive)
	if err != nil {
		return BranchServiceItem{}, err
	}
	svc, err := r.getServiceWithRequirements(ctx, req.ServiceID)
	if err == nil {
		bs.ServiceItem = svc
	}
	return bs, nil
}

func (r *CatalogRepository) ListBranchServices(ctx context.Context, branchID uuid.UUID) ([]BranchServiceItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, branch_id, service_id, is_active FROM branch_services
		WHERE branch_id = $1
	`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []BranchServiceItem
	for rows.Next() {
		var bs BranchServiceItem
		if err := rows.Scan(&bs.ID, &bs.BranchID, &bs.ServiceID, &bs.IsActive); err != nil {
			return nil, err
		}
		svc, err := r.getServiceWithRequirements(ctx, bs.ServiceID)
		if err == nil {
			bs.ServiceItem = svc
		}
		items = append(items, bs)
	}
	if items == nil {
		items = []BranchServiceItem{}
	}
	return items, rows.Err()
}

func (r *CatalogRepository) RemoveBranchService(ctx context.Context, itemID uuid.UUID) error {
	res, err := r.db.Exec(ctx, `DELETE FROM branch_services WHERE id = $1`, itemID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrBranchItemNotFound
	}
	return nil
}

func (r *CatalogRepository) GetBranchServiceBranchID(ctx context.Context, itemID uuid.UUID) (uuid.UUID, error) {
	var bID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT branch_id FROM branch_services WHERE id = $1`, itemID).Scan(&bID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrBranchItemNotFound
	}
	return bID, err
}
