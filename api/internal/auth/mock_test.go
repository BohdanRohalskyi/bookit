package auth

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
	"github.com/BohdanRohalskyi/bookit/api/internal/mail"
)

// mockRepository is a test double for userRepository.
// Unset fields default to safe zero-value behavior so each test only
// configures the methods it actually exercises.
type mockRepository struct {
	getByEmail              func(ctx context.Context, email string) (*identity.User, error)
	getByID                 func(ctx context.Context, id uuid.UUID) (*identity.User, error)
	create                  func(ctx context.Context, email, passwordHash, name, phone string) (*identity.User, error)
	isProvider              func(ctx context.Context, userID uuid.UUID) (bool, error)
	createRefreshToken      func(ctx context.Context, userID uuid.UUID, token string, expiresAt time.Time) error
	validateRefreshToken    func(ctx context.Context, token string) (uuid.UUID, error)
	revokeRefreshToken      func(ctx context.Context, token string) error
	revokeAllUserTokens     func(ctx context.Context, userID uuid.UUID) error
	createAuthToken         func(ctx context.Context, userID uuid.UUID, token, tokenType string, expiresAt time.Time) error
	createAuthTokenWithIP   func(ctx context.Context, userID uuid.UUID, token, tokenType, ipAddress string, expiresAt time.Time) error
	validateAuthToken       func(ctx context.Context, token, tokenType string) (uuid.UUID, error)
	validateAuthTokenWithIP func(ctx context.Context, token, tokenType, ipAddress string) (uuid.UUID, error)
	useAuthToken            func(ctx context.Context, token, tokenType string) error
	setEmailVerified        func(ctx context.Context, userID uuid.UUID) error
	updatePassword          func(ctx context.Context, userID uuid.UUID, passwordHash string) error
}

func (m *mockRepository) GetByEmail(ctx context.Context, email string) (*identity.User, error) {
	if m.getByEmail != nil {
		return m.getByEmail(ctx, email)
	}
	return nil, identity.ErrUserNotFound
}

func (m *mockRepository) GetByID(ctx context.Context, id uuid.UUID) (*identity.User, error) {
	if m.getByID != nil {
		return m.getByID(ctx, id)
	}
	return nil, identity.ErrUserNotFound
}

func (m *mockRepository) Create(ctx context.Context, email, passwordHash, name, phone string) (*identity.User, error) {
	if m.create != nil {
		return m.create(ctx, email, passwordHash, name, phone)
	}
	return nil, nil
}

func (m *mockRepository) IsProvider(ctx context.Context, userID uuid.UUID) (bool, error) {
	if m.isProvider != nil {
		return m.isProvider(ctx, userID)
	}
	return false, nil
}

func (m *mockRepository) CreateRefreshToken(ctx context.Context, userID uuid.UUID, token string, expiresAt time.Time) error {
	if m.createRefreshToken != nil {
		return m.createRefreshToken(ctx, userID, token, expiresAt)
	}
	return nil
}

func (m *mockRepository) ValidateRefreshToken(ctx context.Context, token string) (uuid.UUID, error) {
	if m.validateRefreshToken != nil {
		return m.validateRefreshToken(ctx, token)
	}
	return uuid.Nil, identity.ErrInvalidToken
}

func (m *mockRepository) RevokeRefreshToken(ctx context.Context, token string) error {
	if m.revokeRefreshToken != nil {
		return m.revokeRefreshToken(ctx, token)
	}
	return nil
}

func (m *mockRepository) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	if m.revokeAllUserTokens != nil {
		return m.revokeAllUserTokens(ctx, userID)
	}
	return nil
}

func (m *mockRepository) CreateAuthToken(ctx context.Context, userID uuid.UUID, token, tokenType string, expiresAt time.Time) error {
	if m.createAuthToken != nil {
		return m.createAuthToken(ctx, userID, token, tokenType, expiresAt)
	}
	return nil
}

func (m *mockRepository) CreateAuthTokenWithIP(ctx context.Context, userID uuid.UUID, token, tokenType, ipAddress string, expiresAt time.Time) error {
	if m.createAuthTokenWithIP != nil {
		return m.createAuthTokenWithIP(ctx, userID, token, tokenType, ipAddress, expiresAt)
	}
	return nil
}

func (m *mockRepository) ValidateAuthToken(ctx context.Context, token, tokenType string) (uuid.UUID, error) {
	if m.validateAuthToken != nil {
		return m.validateAuthToken(ctx, token, tokenType)
	}
	return uuid.Nil, identity.ErrInvalidToken
}

func (m *mockRepository) ValidateAuthTokenWithIP(ctx context.Context, token, tokenType, ipAddress string) (uuid.UUID, error) {
	if m.validateAuthTokenWithIP != nil {
		return m.validateAuthTokenWithIP(ctx, token, tokenType, ipAddress)
	}
	return uuid.Nil, identity.ErrInvalidToken
}

func (m *mockRepository) UseAuthToken(ctx context.Context, token, tokenType string) error {
	if m.useAuthToken != nil {
		return m.useAuthToken(ctx, token, tokenType)
	}
	return nil
}

func (m *mockRepository) SetEmailVerified(ctx context.Context, userID uuid.UUID) error {
	if m.setEmailVerified != nil {
		return m.setEmailVerified(ctx, userID)
	}
	return nil
}

func (m *mockRepository) UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	if m.updatePassword != nil {
		return m.updatePassword(ctx, userID, passwordHash)
	}
	return nil
}

// mockMailProvider is a test double for mail.Provider.
type mockMailProvider struct {
	send func(ctx context.Context, msg mail.Message) error
}

func (m *mockMailProvider) Send(ctx context.Context, msg mail.Message) error {
	if m.send != nil {
		return m.send(ctx, msg)
	}
	return nil
}
