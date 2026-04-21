package rbac

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgRepository is the PostgreSQL implementation for RBAC queries.
type PgRepository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *PgRepository {
	return &PgRepository{db: db}
}

// GetUserPermissions returns the union of all permissions the user holds for
// the given business+location scope, across all matching role assignments.
//
// Scope resolution:
//   - A business-level assignment (location_id IS NULL) matches any request
//     for that business regardless of locationID.
//   - A location-level assignment only matches when locationID equals it.
func (r *PgRepository) GetUserPermissions(ctx context.Context, userID, businessID int64, locationID *int64) ([]Permission, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT rp.id, rp.role_id, rp.resource, rp.action
		FROM user_role_assignments ura
		JOIN role_permissions rp ON rp.role_id = ura.role_id
		WHERE ura.user_id     = $1
		  AND ura.business_id = $2
		  AND (
		      ura.location_id IS NULL
		      OR ($3::bigint IS NOT NULL AND ura.location_id = $3)
		  )
	`, userID, businessID, locationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var perms []Permission
	for rows.Next() {
		var p Permission
		if err := rows.Scan(&p.ID, &p.RoleID, &p.Resource, &p.Action); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	if perms == nil {
		perms = []Permission{}
	}
	return perms, rows.Err()
}

// GetUserMemberships returns all businesses the user has a role assignment in,
// grouped by (business, role). Used to build the space picker.
func (r *PgRepository) GetUserMemberships(ctx context.Context, userID int64) ([]Membership, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
		    ura.business_id,
		    b.name,
		    b.category,
		    b.is_active,
		    r.slug AS role,
		    COALESCE(
		        ARRAY_AGG(ura.location_id ORDER BY ura.location_id)
		        FILTER (WHERE ura.location_id IS NOT NULL),
		        '{}'::bigint[]
		    ) AS location_ids
		FROM user_role_assignments ura
		JOIN roles r      ON r.id = ura.role_id
		JOIN businesses b ON b.id = ura.business_id
		WHERE ura.user_id = $1
		GROUP BY ura.business_id, b.name, b.category, b.is_active, r.slug
		ORDER BY b.name
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memberships []Membership
	for rows.Next() {
		var m Membership
		var locationIDs []int64
		if err := rows.Scan(
			&m.BusinessID, &m.BusinessName, &m.Category, &m.IsActive, &m.Role, &locationIDs,
		); err != nil {
			return nil, err
		}
		m.LocationIDs = locationIDs
		memberships = append(memberships, m)
	}
	if memberships == nil {
		memberships = []Membership{}
	}
	return memberships, rows.Err()
}

// AssignRole creates a user_role_assignment. Returns ErrAssignmentExists on duplicate.
func (r *PgRepository) AssignRole(ctx context.Context, a UserRoleAssignment) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO user_role_assignments
		    (user_id, role_id, business_id, location_id, assigned_by)
		VALUES ($1, $2, $3, $4, $5)
	`, a.UserID, a.RoleID, a.BusinessID, a.LocationID, a.AssignedBy)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrAssignmentExists
		}
		return err
	}
	return nil
}

// RevokeRole deletes a user_role_assignment scoped to a business.
// Returns ErrAssignmentNotFound if no row was deleted.
func (r *PgRepository) RevokeRole(ctx context.Context, assignmentID, businessID int64) error {
	result, err := r.db.Exec(ctx, `
		DELETE FROM user_role_assignments
		WHERE id = $1 AND business_id = $2
	`, assignmentID, businessID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrAssignmentNotFound
	}
	return nil
}

// GetRoleBySlug returns the integer id of the system role with the given slug.
func (r *PgRepository) GetRoleBySlug(ctx context.Context, slug string) (int64, error) {
	var id int64
	err := r.db.QueryRow(ctx, `
		SELECT id FROM roles WHERE slug = $1 AND is_system = true AND business_id IS NULL
	`, slug).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrAssignmentNotFound
	}
	return id, err
}
