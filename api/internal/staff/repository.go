package staff

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// ListMembers returns active role assignments and non-expired pending invites
// for a business, merged into a single list ordered by creation time.
func (r *Repository) ListMembers(ctx context.Context, businessID uuid.UUID) ([]Member, error) {
	rows, err := r.db.Query(ctx, `
		SELECT 'active'::text AS status,
		       ura.id,
		       ura.user_id,
		       u.email,
		       u.name,
		       ro.slug AS role,
		       ura.location_id,
		       ura.created_at
		FROM user_role_assignments ura
		JOIN users u  ON u.id  = ura.user_id
		JOIN roles ro ON ro.id = ura.role_id
		WHERE ura.business_id = $1

		UNION ALL

		SELECT 'pending'::text AS status,
		       inv.id,
		       NULL::uuid AS user_id,
		       inv.email,
		       NULL::text AS name,
		       ro.slug AS role,
		       inv.location_id,
		       inv.created_at
		FROM invites inv
		JOIN roles ro ON ro.id = inv.role_id
		WHERE inv.business_id = $1
		  AND inv.accepted_at IS NULL
		  AND inv.expires_at  > NOW()

		ORDER BY created_at DESC
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []Member
	for rows.Next() {
		var m Member
		var name *string
		if err := rows.Scan(
			&m.Status, &m.ID, &m.UserID, &m.Email, &name, &m.Role, &m.LocationID, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		m.Name = name
		members = append(members, m)
	}
	if members == nil {
		members = []Member{}
	}
	return members, rows.Err()
}

// CreateInvite inserts a new invite record.
func (r *Repository) CreateInvite(ctx context.Context, inv InviteCreate) (Invite, error) {
	var out Invite
	err := r.db.QueryRow(ctx, `
		INSERT INTO invites (email, role_id, business_id, location_id, invited_by, token_hash, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, email, role_id, business_id, location_id, invited_by, expires_at, accepted_at, created_at
	`, inv.Email, inv.RoleID, inv.BusinessID, inv.LocationID, inv.InvitedBy, inv.TokenHash, inv.ExpiresAt,
	).Scan(
		&out.ID, &out.Email, &out.RoleID, &out.BusinessID, &out.LocationID,
		&out.InvitedBy, &out.ExpiresAt, &out.AcceptedAt, &out.CreatedAt,
	)
	return out, err
}

// GetInviteByToken looks up a pending invite by its raw (unhashed) token.
func (r *Repository) GetInviteByToken(ctx context.Context, token string) (Invite, error) {
	var inv Invite
	err := r.db.QueryRow(ctx, `
		SELECT inv.id, inv.email, inv.role_id, inv.business_id, inv.location_id,
		       inv.invited_by, inv.expires_at, inv.accepted_at, inv.created_at,
		       r.slug AS role_slug,
		       b.name AS business_name
		FROM invites inv
		JOIN roles      r ON r.id = inv.role_id
		JOIN businesses b ON b.id = inv.business_id
		WHERE inv.token_hash = $1
	`, hashToken(token)).Scan(
		&inv.ID, &inv.Email, &inv.RoleID, &inv.BusinessID, &inv.LocationID,
		&inv.InvitedBy, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt,
		&inv.RoleSlug, &inv.BusinessName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Invite{}, ErrInviteNotFound
	}
	return inv, err
}

// AcceptInvite marks the invite as accepted (sets accepted_at = NOW()).
func (r *Repository) AcceptInvite(ctx context.Context, inviteID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `
		UPDATE invites SET accepted_at = NOW()
		WHERE id = $1 AND accepted_at IS NULL
	`, inviteID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrInviteAlreadyUsed
	}
	return nil
}

// CancelInvite deletes a pending invite scoped to a business.
func (r *Repository) CancelInvite(ctx context.Context, inviteID, businessID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `
		DELETE FROM invites WHERE id = $1 AND business_id = $2 AND accepted_at IS NULL
	`, inviteID, businessID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrInviteNotFound
	}
	return nil
}

// GetPendingInvitesByEmail returns all non-expired, non-accepted invites for an email.
// Used to auto-accept on registration.
func (r *Repository) GetPendingInvitesByEmail(ctx context.Context, email string) ([]Invite, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, email, role_id, business_id, location_id, invited_by,
		       expires_at, accepted_at, created_at
		FROM invites
		WHERE LOWER(email) = LOWER($1)
		  AND accepted_at IS NULL
		  AND expires_at  > NOW()
	`, email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invites []Invite
	for rows.Next() {
		var inv Invite
		if err := rows.Scan(
			&inv.ID, &inv.Email, &inv.RoleID, &inv.BusinessID, &inv.LocationID,
			&inv.InvitedBy, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt,
		); err != nil {
			return nil, err
		}
		invites = append(invites, inv)
	}
	return invites, rows.Err()
}

// GetBusinessName returns the name of a business. Used for email templates.
func (r *Repository) GetBusinessName(ctx context.Context, businessID uuid.UUID) (string, error) {
	var name string
	err := r.db.QueryRow(ctx, `SELECT name FROM businesses WHERE id = $1`, businessID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrMemberNotFound
	}
	return name, err
}

// GetOwnedBusinesses returns all businesses owned by a provider (via providers.user_id join).
func (r *Repository) GetOwnedBusinesses(ctx context.Context, userID uuid.UUID) ([]OwnedBusiness, error) {
	rows, err := r.db.Query(ctx, `
		SELECT b.id, b.name, b.category, b.is_active
		FROM businesses b
		JOIN providers p ON p.id = b.provider_id
		WHERE p.user_id = $1
		ORDER BY b.name
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var owned []OwnedBusiness
	for rows.Next() {
		var o OwnedBusiness
		if err := rows.Scan(&o.BusinessID, &o.BusinessName, &o.Category, &o.IsActive); err != nil {
			return nil, err
		}
		owned = append(owned, o)
	}
	if owned == nil {
		owned = []OwnedBusiness{}
	}
	return owned, rows.Err()
}

// FindUserIDByEmail returns the user ID for an email address, or ErrMemberNotFound.
func (r *Repository) FindUserIDByEmail(ctx context.Context, email string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, email).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrMemberNotFound
	}
	return id, err
}

// RemoveMember deletes an active role assignment scoped to a business.
func (r *Repository) RemoveMember(ctx context.Context, assignmentID, businessID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `
		DELETE FROM user_role_assignments WHERE id = $1 AND business_id = $2
	`, assignmentID, businessID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrMemberNotFound
	}
	return nil
}

// txAcceptInvite atomically accepts an invite and creates the role assignment.
// Runs in a single transaction to prevent partial state.
func (r *Repository) txAcceptInvite(ctx context.Context, inv Invite, userID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }() //nolint:errcheck

	// Mark invite accepted
	result, err := tx.Exec(ctx, `
		UPDATE invites SET accepted_at = NOW()
		WHERE id = $1 AND accepted_at IS NULL
	`, inv.ID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrInviteAlreadyUsed
	}

	// Create assignment
	_, err = tx.Exec(ctx, `
		INSERT INTO user_role_assignments (user_id, role_id, business_id, location_id, assigned_by)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT DO NOTHING
	`, userID, inv.RoleID, inv.BusinessID, inv.LocationID, inv.InvitedBy)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// GetInviteExpiresAt is a thin helper for computing the 7-day expiry in the service.
func InviteExpiresAt() time.Time {
	return time.Now().UTC().Add(7 * 24 * time.Hour)
}
