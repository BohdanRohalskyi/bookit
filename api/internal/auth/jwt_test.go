package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testJWTSecret = "test-jwt-secret-for-testing-only-32chars"

func TestJWTService_GenerateAccessToken(t *testing.T) {
	t.Parallel()

	svc := NewJWTService(testJWTSecret)
	userID := uuid.New()

	token, err := svc.GenerateAccessToken(userID)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := svc.ValidateAccessToken(token)
	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, "bookit", claims.Issuer)
	assert.WithinDuration(t, time.Now().Add(AccessTokenDuration), claims.ExpiresAt.Time, 5*time.Second)
}

func TestJWTService_ValidateAccessToken(t *testing.T) {
	t.Parallel()

	svc := NewJWTService(testJWTSecret)
	userID := uuid.New()

	t.Run("valid token returns correct claims", func(t *testing.T) {
		t.Parallel()
		token, err := svc.GenerateAccessToken(userID)
		require.NoError(t, err)

		claims, err := svc.ValidateAccessToken(token)
		require.NoError(t, err)
		assert.Equal(t, userID, claims.UserID)
	})

	t.Run("expired token returns ErrExpiredToken", func(t *testing.T) {
		t.Parallel()
		past := time.Now().Add(-time.Hour)
		claims := Claims{
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(past),
				IssuedAt:  jwt.NewNumericDate(past),
				NotBefore: jwt.NewNumericDate(past),
				Issuer:    "bookit",
				Subject:   userID.String(),
			},
			UserID: userID,
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signed, err := token.SignedString([]byte(testJWTSecret))
		require.NoError(t, err)

		_, err = svc.ValidateAccessToken(signed)
		assert.ErrorIs(t, err, ErrExpiredToken)
	})

	t.Run("token signed with different key returns ErrInvalidToken", func(t *testing.T) {
		t.Parallel()
		otherSvc := NewJWTService("other-secret-that-is-also-at-least-32chars!")
		token, err := otherSvc.GenerateAccessToken(userID)
		require.NoError(t, err)

		_, err = svc.ValidateAccessToken(token)
		assert.ErrorIs(t, err, ErrInvalidToken)
	})

	t.Run("malformed token returns ErrInvalidToken", func(t *testing.T) {
		t.Parallel()
		_, err := svc.ValidateAccessToken("not.a.valid.jwt")
		assert.ErrorIs(t, err, ErrInvalidToken)
	})

	t.Run("empty token returns ErrInvalidToken", func(t *testing.T) {
		t.Parallel()
		_, err := svc.ValidateAccessToken("")
		assert.ErrorIs(t, err, ErrInvalidToken)
	})
}

func TestGenerateRefreshToken(t *testing.T) {
	t.Parallel()

	t.Run("returns a non-empty token", func(t *testing.T) {
		t.Parallel()
		token, err := GenerateRefreshToken()
		require.NoError(t, err)
		assert.NotEmpty(t, token)
	})

	t.Run("generates unique tokens on each call", func(t *testing.T) {
		t.Parallel()
		token1, err := GenerateRefreshToken()
		require.NoError(t, err)
		token2, err := GenerateRefreshToken()
		require.NoError(t, err)
		assert.NotEqual(t, token1, token2)
	})
}
