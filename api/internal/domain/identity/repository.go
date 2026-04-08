package identity

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrEmailExists  = errors.New("email already exists")
	ErrInvalidToken = errors.New("invalid or expired token")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetByEmail(ctx context.Context, email string) (*User, error) {
	var user User
	var phone *string

	err := r.db.QueryRow(ctx, `
		SELECT id, email, password_hash, name, phone, email_verified, created_at, updated_at
		FROM users
		WHERE LOWER(email) = LOWER($1)
	`, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&phone,
		&user.EmailVerified,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	user.Phone = phone
	return &user, nil
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var user User
	var phone *string

	err := r.db.QueryRow(ctx, `
		SELECT id, email, password_hash, name, phone, email_verified, created_at, updated_at
		FROM users
		WHERE id = $1
	`, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&phone,
		&user.EmailVerified,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	user.Phone = phone
	return &user, nil
}

func (r *Repository) Create(ctx context.Context, email, passwordHash, name, phone string) (*User, error) {
	var user User
	var phonePtr *string
	if phone != "" {
		phonePtr = &phone
	}

	err := r.db.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, name, phone, email_verified)
		VALUES ($1, $2, $3, $4, false)
		RETURNING id, email, password_hash, name, phone, email_verified, created_at, updated_at
	`, strings.ToLower(email), passwordHash, name, phonePtr).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.Phone,
		&user.EmailVerified,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if strings.Contains(err.Error(), "idx_users_email_lower") {
			return nil, ErrEmailExists
		}
		return nil, err
	}

	return &user, nil
}

func (r *Repository) IsProvider(ctx context.Context, userID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM providers WHERE user_id = $1)
	`, userID).Scan(&exists)
	if err != nil {
		// If providers table doesn't exist yet, just return false
		if strings.Contains(err.Error(), "does not exist") {
			return false, nil
		}
		return false, err
	}
	return exists, nil
}

// Refresh token methods

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func (r *Repository) CreateRefreshToken(ctx context.Context, userID uuid.UUID, token string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, hashToken(token), expiresAt)
	return err
}

func (r *Repository) ValidateRefreshToken(ctx context.Context, token string) (uuid.UUID, error) {
	var userID uuid.UUID
	var expiresAt time.Time

	err := r.db.QueryRow(ctx, `
		SELECT user_id, expires_at
		FROM refresh_tokens
		WHERE token_hash = $1 AND revoked_at IS NULL
	`, hashToken(token)).Scan(&userID, &expiresAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrInvalidToken
	}
	if err != nil {
		return uuid.Nil, err
	}

	if time.Now().After(expiresAt) {
		return uuid.Nil, ErrInvalidToken
	}

	return userID, nil
}

func (r *Repository) RevokeRefreshToken(ctx context.Context, token string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = NOW()
		WHERE token_hash = $1 AND revoked_at IS NULL
	`, hashToken(token))
	return err
}

func (r *Repository) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL
	`, userID)
	return err
}

// Auth token methods (email verification, password reset)

const (
	TokenTypeEmailVerification = "email_verification"
	TokenTypePasswordReset     = "password_reset"
	TokenTypeAppSwitch         = "app_switch"
)

func (r *Repository) CreateAuthToken(ctx context.Context, userID uuid.UUID, token, tokenType string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at)
		VALUES ($1, $2, $3, $4)
	`, userID, hashToken(token), tokenType, expiresAt)
	return err
}

func (r *Repository) CreateAuthTokenWithIP(ctx context.Context, userID uuid.UUID, token, tokenType, ipAddress string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO auth_tokens (user_id, token_hash, token_type, ip_address, expires_at)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, hashToken(token), tokenType, ipAddress, expiresAt)
	return err
}

func (r *Repository) ValidateAuthToken(ctx context.Context, token, tokenType string) (uuid.UUID, error) {
	var userID uuid.UUID
	var expiresAt time.Time

	err := r.db.QueryRow(ctx, `
		SELECT user_id, expires_at
		FROM auth_tokens
		WHERE token_hash = $1 AND token_type = $2 AND used_at IS NULL
	`, hashToken(token), tokenType).Scan(&userID, &expiresAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrInvalidToken
	}
	if err != nil {
		return uuid.Nil, err
	}

	if time.Now().After(expiresAt) {
		return uuid.Nil, ErrInvalidToken
	}

	return userID, nil
}

func (r *Repository) ValidateAuthTokenWithIP(ctx context.Context, token, tokenType, ipAddress string) (uuid.UUID, error) {
	var userID uuid.UUID
	var expiresAt time.Time
	var storedIP *string

	err := r.db.QueryRow(ctx, `
		SELECT user_id, expires_at, ip_address
		FROM auth_tokens
		WHERE token_hash = $1 AND token_type = $2 AND used_at IS NULL
	`, hashToken(token), tokenType).Scan(&userID, &expiresAt, &storedIP)

	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrInvalidToken
	}
	if err != nil {
		return uuid.Nil, err
	}

	if time.Now().After(expiresAt) {
		return uuid.Nil, ErrInvalidToken
	}

	// Check IP if stored
	if storedIP != nil && *storedIP != ipAddress {
		return uuid.Nil, ErrInvalidToken
	}

	return userID, nil
}

func (r *Repository) UseAuthToken(ctx context.Context, token, tokenType string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE auth_tokens
		SET used_at = NOW()
		WHERE token_hash = $1 AND token_type = $2 AND used_at IS NULL
	`, hashToken(token), tokenType)
	return err
}

func (r *Repository) SetEmailVerified(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users
		SET email_verified = true
		WHERE id = $1
	`, userID)
	return err
}

func (r *Repository) UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users
		SET password_hash = $1
		WHERE id = $2
	`, passwordHash, userID)
	return err
}
