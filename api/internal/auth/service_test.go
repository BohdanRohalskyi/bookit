package auth

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
	"github.com/BohdanRohalskyi/bookit/api/internal/mail"
)

func TestMain(m *testing.M) {
	// Lower bcrypt cost so password-hashing tests run in milliseconds.
	bcryptCost = bcrypt.MinCost
	os.Exit(m.Run())
}

// newTestService creates a Service wired with the given doubles.
func newTestService(repo userRepository, mailProvider mail.Provider) *Service {
	return NewService(repo, testJWTSecret, mailProvider, mail.NewTemplates("http://localhost:5173"))
}

// testUser returns a User whose password hash corresponds to "password123".
func testUser() *identity.User {
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	return &identity.User{
		ID:            uuid.New(),
		Email:         "test@example.com",
		PasswordHash:  string(hash),
		Name:          "Test User",
		EmailVerified: false,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

// --- Register ---

func TestService_Register(t *testing.T) {
	t.Parallel()

	t.Run("creates user and returns tokens", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			create: func(_ context.Context, _, _, _, _ string) (*identity.User, error) {
				return user, nil
			},
		}
		resp, err := newTestService(repo, &mockMailProvider{}).Register(
			context.Background(), user.Email, "password123", user.Name, "",
		)
		require.NoError(t, err)
		assert.Equal(t, user.Email, resp.User.Email)
		assert.NotEmpty(t, resp.Tokens.AccessToken)
		assert.NotEmpty(t, resp.Tokens.RefreshToken)
		assert.Equal(t, int(AccessTokenDuration.Seconds()), resp.Tokens.ExpiresIn)
	})

	t.Run("returns ErrEmailExists when email is already taken", func(t *testing.T) {
		t.Parallel()
		existing := testUser()
		repo := &mockRepository{
			getByEmail: func(_ context.Context, _ string) (*identity.User, error) {
				return existing, nil // email found → conflict
			},
		}
		_, err := newTestService(repo, &mockMailProvider{}).Register(
			context.Background(), existing.Email, "password123", "Name", "",
		)
		assert.ErrorIs(t, err, identity.ErrEmailExists)
	})

	t.Run("propagates unexpected repository error", func(t *testing.T) {
		t.Parallel()
		dbErr := errors.New("connection refused")
		repo := &mockRepository{
			getByEmail: func(_ context.Context, _ string) (*identity.User, error) {
				return nil, dbErr
			},
		}
		_, err := newTestService(repo, &mockMailProvider{}).Register(
			context.Background(), "test@example.com", "password123", "Name", "",
		)
		assert.ErrorIs(t, err, dbErr)
	})
}

// --- Login ---

func TestService_Login(t *testing.T) {
	t.Parallel()

	t.Run("returns tokens on valid credentials", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			getByEmail: func(_ context.Context, _ string) (*identity.User, error) { return user, nil },
		}
		resp, err := newTestService(repo, &mockMailProvider{}).Login(
			context.Background(), user.Email, "password123",
		)
		require.NoError(t, err)
		assert.Equal(t, user.Email, resp.User.Email)
		assert.NotEmpty(t, resp.Tokens.AccessToken)
	})

	t.Run("returns ErrInvalidCredentials for unknown email", func(t *testing.T) {
		t.Parallel()
		// getByEmail defaults to ErrUserNotFound
		_, err := newTestService(&mockRepository{}, &mockMailProvider{}).Login(
			context.Background(), "nobody@example.com", "password123",
		)
		assert.ErrorIs(t, err, ErrInvalidCredentials)
	})

	t.Run("returns ErrInvalidCredentials for wrong password", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			getByEmail: func(_ context.Context, _ string) (*identity.User, error) { return user, nil },
		}
		_, err := newTestService(repo, &mockMailProvider{}).Login(
			context.Background(), user.Email, "wrongpassword",
		)
		assert.ErrorIs(t, err, ErrInvalidCredentials)
	})

	t.Run("sets IsProvider flag when user is a provider", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			getByEmail: func(_ context.Context, _ string) (*identity.User, error) { return user, nil },
			isProvider: func(_ context.Context, _ uuid.UUID) (bool, error) { return true, nil },
		}
		resp, err := newTestService(repo, &mockMailProvider{}).Login(
			context.Background(), user.Email, "password123",
		)
		require.NoError(t, err)
		assert.True(t, resp.User.IsProvider)
	})
}

// --- Refresh ---

func TestService_Refresh(t *testing.T) {
	t.Parallel()

	t.Run("issues new tokens for a valid refresh token", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			validateRefreshToken: func(_ context.Context, _ string) (uuid.UUID, error) {
				return user.ID, nil
			},
			getByID: func(_ context.Context, _ uuid.UUID) (*identity.User, error) { return user, nil },
		}
		resp, err := newTestService(repo, &mockMailProvider{}).Refresh(
			context.Background(), "valid-refresh-token",
		)
		require.NoError(t, err)
		assert.NotEmpty(t, resp.Tokens.AccessToken)
		assert.NotEmpty(t, resp.Tokens.RefreshToken)
	})

	t.Run("returns ErrInvalidToken for an invalid refresh token", func(t *testing.T) {
		t.Parallel()
		// validateRefreshToken defaults to ErrInvalidToken
		_, err := newTestService(&mockRepository{}, &mockMailProvider{}).Refresh(
			context.Background(), "bad-token",
		)
		assert.ErrorIs(t, err, identity.ErrInvalidToken)
	})
}

// --- Logout ---

func TestService_Logout(t *testing.T) {
	t.Parallel()

	t.Run("revokes the provided refresh token", func(t *testing.T) {
		t.Parallel()
		revoked := false
		repo := &mockRepository{
			revokeRefreshToken: func(_ context.Context, _ string) error {
				revoked = true
				return nil
			},
		}
		err := newTestService(repo, &mockMailProvider{}).Logout(context.Background(), "some-token")
		require.NoError(t, err)
		assert.True(t, revoked)
	})
}

// --- VerifyEmail ---

func TestService_VerifyEmail(t *testing.T) {
	t.Parallel()

	t.Run("marks email as verified for a valid token", func(t *testing.T) {
		t.Parallel()
		userID := uuid.New()
		verified := false
		repo := &mockRepository{
			validateAuthToken: func(_ context.Context, _, _ string) (uuid.UUID, error) {
				return userID, nil
			},
			setEmailVerified: func(_ context.Context, _ uuid.UUID) error {
				verified = true
				return nil
			},
		}
		err := newTestService(repo, &mockMailProvider{}).VerifyEmail(context.Background(), "valid-token")
		require.NoError(t, err)
		assert.True(t, verified)
	})

	t.Run("returns ErrInvalidToken for an invalid token", func(t *testing.T) {
		t.Parallel()
		// validateAuthToken defaults to ErrInvalidToken
		err := newTestService(&mockRepository{}, &mockMailProvider{}).VerifyEmail(
			context.Background(), "bad-token",
		)
		assert.ErrorIs(t, err, identity.ErrInvalidToken)
	})
}

// --- ResendVerificationEmail ---

func TestService_ResendVerificationEmail(t *testing.T) {
	t.Parallel()

	t.Run("sends a verification email for an unverified user", func(t *testing.T) {
		t.Parallel()
		user := testUser() // EmailVerified = false
		emailSent := false
		repo := &mockRepository{
			getByID: func(_ context.Context, _ uuid.UUID) (*identity.User, error) { return user, nil },
		}
		mailProvider := &mockMailProvider{
			send: func(_ context.Context, _ mail.Message) error {
				emailSent = true
				return nil
			},
		}
		err := newTestService(repo, mailProvider).ResendVerificationEmail(context.Background(), user.ID)
		require.NoError(t, err)
		assert.True(t, emailSent)
	})

	t.Run("returns ErrEmailAlreadyVerified for a verified user", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		user.EmailVerified = true
		repo := &mockRepository{
			getByID: func(_ context.Context, _ uuid.UUID) (*identity.User, error) { return user, nil },
		}
		err := newTestService(repo, &mockMailProvider{}).ResendVerificationEmail(
			context.Background(), user.ID,
		)
		assert.ErrorIs(t, err, ErrEmailAlreadyVerified)
	})
}

// --- RequestPasswordReset ---

func TestService_RequestPasswordReset(t *testing.T) {
	t.Parallel()

	t.Run("sends a password reset email for a known address", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		emailSent := false
		repo := &mockRepository{
			getByEmail: func(_ context.Context, _ string) (*identity.User, error) { return user, nil },
		}
		mailProvider := &mockMailProvider{
			send: func(_ context.Context, _ mail.Message) error {
				emailSent = true
				return nil
			},
		}
		err := newTestService(repo, mailProvider).RequestPasswordReset(
			context.Background(), user.Email,
		)
		require.NoError(t, err)
		assert.True(t, emailSent)
	})

	t.Run("returns nil for an unknown email to prevent enumeration", func(t *testing.T) {
		t.Parallel()
		// getByEmail defaults to ErrUserNotFound
		err := newTestService(&mockRepository{}, &mockMailProvider{}).RequestPasswordReset(
			context.Background(), "nobody@example.com",
		)
		assert.NoError(t, err)
	})
}

// --- ResetPassword ---

func TestService_ResetPassword(t *testing.T) {
	t.Parallel()

	t.Run("updates password and revokes all refresh tokens", func(t *testing.T) {
		t.Parallel()
		userID := uuid.New()
		passwordUpdated := false
		tokensRevoked := false
		repo := &mockRepository{
			validateAuthToken: func(_ context.Context, _, _ string) (uuid.UUID, error) {
				return userID, nil
			},
			updatePassword: func(_ context.Context, _ uuid.UUID, _ string) error {
				passwordUpdated = true
				return nil
			},
			revokeAllUserTokens: func(_ context.Context, _ uuid.UUID) error {
				tokensRevoked = true
				return nil
			},
		}
		err := newTestService(repo, &mockMailProvider{}).ResetPassword(
			context.Background(), "valid-token", "newpassword123",
		)
		require.NoError(t, err)
		assert.True(t, passwordUpdated)
		assert.True(t, tokensRevoked)
	})

	t.Run("returns ErrInvalidToken for an invalid token", func(t *testing.T) {
		t.Parallel()
		// validateAuthToken defaults to ErrInvalidToken
		err := newTestService(&mockRepository{}, &mockMailProvider{}).ResetPassword(
			context.Background(), "bad-token", "newpassword123",
		)
		assert.ErrorIs(t, err, identity.ErrInvalidToken)
	})
}

// --- CreateAppSwitchToken ---

func TestService_CreateAppSwitchToken(t *testing.T) {
	t.Parallel()

	t.Run("returns a non-empty token", func(t *testing.T) {
		t.Parallel()
		// createAuthTokenWithIP defaults to nil (success)
		token, err := newTestService(&mockRepository{}, &mockMailProvider{}).CreateAppSwitchToken(
			context.Background(), uuid.New(), "127.0.0.1",
		)
		require.NoError(t, err)
		assert.NotEmpty(t, token)
	})
}

// --- ExchangeAppSwitchToken ---

func TestService_ExchangeAppSwitchToken(t *testing.T) {
	t.Parallel()

	t.Run("returns an auth response for a valid switch token", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			validateAuthTokenWithIP: func(_ context.Context, _, _, _ string) (uuid.UUID, error) {
				return user.ID, nil
			},
			getByID: func(_ context.Context, _ uuid.UUID) (*identity.User, error) { return user, nil },
		}
		resp, err := newTestService(repo, &mockMailProvider{}).ExchangeAppSwitchToken(
			context.Background(), "valid-token", "127.0.0.1",
		)
		require.NoError(t, err)
		assert.NotEmpty(t, resp.Tokens.AccessToken)
	})

	t.Run("returns ErrInvalidToken for an invalid switch token", func(t *testing.T) {
		t.Parallel()
		// validateAuthTokenWithIP defaults to ErrInvalidToken
		_, err := newTestService(&mockRepository{}, &mockMailProvider{}).ExchangeAppSwitchToken(
			context.Background(), "bad-token", "127.0.0.1",
		)
		assert.ErrorIs(t, err, identity.ErrInvalidToken)
	})
}
