package catalog

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository handles all DB operations for the catalog domain.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, providerID uuid.UUID, req BusinessCreate) (Business, error) {
	var b Business
	err := r.db.QueryRow(ctx, `
		INSERT INTO businesses (provider_id, name, category, description, logo_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, provider_id, name, category, description, logo_url, is_active, created_at, updated_at
	`, providerID, req.Name, req.Category, req.Description, req.LogoURL).Scan(
		&b.ID, &b.ProviderID, &b.Name, &b.Category,
		&b.Description, &b.LogoURL, &b.IsActive, &b.CreatedAt, &b.UpdatedAt,
	)
	return b, err
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (Business, error) {
	var b Business
	err := r.db.QueryRow(ctx, `
		SELECT id, provider_id, name, category, description, logo_url, is_active, created_at, updated_at
		FROM businesses
		WHERE id = $1
	`, id).Scan(
		&b.ID, &b.ProviderID, &b.Name, &b.Category,
		&b.Description, &b.LogoURL, &b.IsActive, &b.CreatedAt, &b.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Business{}, ErrBusinessNotFound
	}
	return b, err
}

func (r *Repository) ListByProviderID(ctx context.Context, providerID uuid.UUID, page, perPage int) ([]Business, int, error) {
	offset := (page - 1) * perPage

	var total int
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM businesses WHERE provider_id = $1
	`, providerID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, provider_id, name, category, description, logo_url, is_active, created_at, updated_at
		FROM businesses
		WHERE provider_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, providerID, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var businesses []Business
	for rows.Next() {
		var b Business
		if err := rows.Scan(
			&b.ID, &b.ProviderID, &b.Name, &b.Category,
			&b.Description, &b.LogoURL, &b.IsActive, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		businesses = append(businesses, b)
	}
	if businesses == nil {
		businesses = []Business{}
	}
	return businesses, total, rows.Err()
}

func (r *Repository) Update(ctx context.Context, id uuid.UUID, req BusinessUpdate) (Business, error) {
	var b Business
	err := r.db.QueryRow(ctx, `
		UPDATE businesses SET
			name        = COALESCE($2, name),
			description = COALESCE($3, description),
			logo_url    = COALESCE($4, logo_url),
			is_active   = COALESCE($5, is_active),
			updated_at  = NOW()
		WHERE id = $1
		RETURNING id, provider_id, name, category, description, logo_url, is_active, created_at, updated_at
	`, id, req.Name, req.Description, req.LogoURL, req.IsActive).Scan(
		&b.ID, &b.ProviderID, &b.Name, &b.Category,
		&b.Description, &b.LogoURL, &b.IsActive, &b.CreatedAt, &b.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Business{}, ErrBusinessNotFound
	}
	return b, err
}

func (r *Repository) UpdateLogoURL(ctx context.Context, id uuid.UUID, logoURL string) (Business, error) {
	var b Business
	err := r.db.QueryRow(ctx, `
		UPDATE businesses SET logo_url = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING id, provider_id, name, category, description, logo_url, is_active, created_at, updated_at
	`, id, logoURL).Scan(
		&b.ID, &b.ProviderID, &b.Name, &b.Category,
		&b.Description, &b.LogoURL, &b.IsActive, &b.CreatedAt, &b.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Business{}, ErrBusinessNotFound
	}
	return b, err
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM businesses WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrBusinessNotFound
	}
	return nil
}

// GetBusinessProviderID returns the provider_id for a business.
// Used by the RBAC identity adapter to verify ownership without loading the full record.
func (r *Repository) GetBusinessProviderID(ctx context.Context, businessID uuid.UUID) (uuid.UUID, error) {
	var providerID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT provider_id FROM businesses WHERE id = $1`, businessID).Scan(&providerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrBusinessNotFound
	}
	return providerID, err
}
