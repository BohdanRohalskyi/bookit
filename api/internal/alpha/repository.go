package alpha

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, req AccessRequestCreate) (AccessRequest, error) {
	var ar AccessRequest
	err := r.db.QueryRow(ctx, `
		INSERT INTO alpha_access_requests (email, company_name, description)
		VALUES ($1, $2, $3)
		RETURNING id, uuid, email, company_name, description, created_at
	`, req.Email, req.CompanyName, req.Description).
		Scan(&ar.ID, &ar.UUID, &ar.Email, &ar.CompanyName, &ar.Description, &ar.CreatedAt)
	return ar, err
}
