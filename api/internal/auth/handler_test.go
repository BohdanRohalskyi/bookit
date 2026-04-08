package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
	"github.com/BohdanRohalskyi/bookit/api/internal/mail"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newTestRouter wires a real Service + Handler onto a Gin router using the
// provided test doubles, mirroring the route setup in main.go.
func newTestRouter(repo userRepository, mailProvider mail.Provider) *gin.Engine {
	svc := NewService(repo, testJWTSecret, mailProvider, mail.NewTemplates("http://localhost:5173"))
	h := NewHandler(svc)

	r := gin.New()

	public := r.Group("/api/v1/auth")
	public.POST("/register", h.Register)
	public.POST("/login", h.Login)
	public.POST("/refresh", h.Refresh)
	public.POST("/logout", h.Logout)
	public.POST("/verify-email", h.VerifyEmail)
	public.POST("/forgot-password", h.ForgotPassword)
	public.POST("/reset-password", h.ResetPassword)
	public.POST("/exchange-app-switch-token", h.ExchangeAppSwitchToken)

	protected := r.Group("/api/v1/auth")
	protected.Use(h.AuthMiddleware())
	protected.POST("/resend-verification", h.ResendVerification)
	protected.POST("/app-switch-token", h.CreateAppSwitchToken)

	return r
}

// bearerToken generates a valid signed JWT for the given user ID.
func bearerToken(userID uuid.UUID) string {
	token, _ := NewJWTService(testJWTSecret).GenerateAccessToken(userID)
	return fmt.Sprintf("Bearer %s", token)
}

// do sends an HTTP request to the router and returns the recorded response.
func do(r *gin.Engine, method, path string, body any, headers map[string]string) *httptest.ResponseRecorder {
	var b []byte
	if body != nil {
		b, _ = json.Marshal(body)
	}
	req := httptest.NewRequestWithContext(context.Background(), method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

// --- Register ---

func TestHandler_Register(t *testing.T) {
	t.Parallel()

	t.Run("201 on valid request", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			create: func(_ context.Context, _, _, _, _ string) (*identity.User, error) {
				return user, nil
			},
		}
		rr := do(newTestRouter(repo, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/register",
			map[string]any{"email": user.Email, "password": "password123", "name": user.Name, "phone": "+37061234567"},
			nil,
		)
		assert.Equal(t, http.StatusCreated, rr.Code)
		var resp map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
		assert.NotNil(t, resp["user"])
		assert.NotNil(t, resp["tokens"])
	})

	t.Run("400 on missing required fields", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/register",
			map[string]any{"email": "test@example.com"}, // missing password, name, phone
			nil,
		)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("409 on duplicate email", func(t *testing.T) {
		t.Parallel()
		existing := testUser()
		repo := &mockRepository{
			getByEmail: func(_ context.Context, _ string) (*identity.User, error) { return existing, nil },
		}
		rr := do(newTestRouter(repo, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/register",
			map[string]any{"email": existing.Email, "password": "password123", "name": "Name", "phone": "+37061234567"},
			nil,
		)
		assert.Equal(t, http.StatusConflict, rr.Code)
	})
}

// --- Login ---

func TestHandler_Login(t *testing.T) {
	t.Parallel()

	t.Run("200 on valid credentials", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			getByEmail: func(_ context.Context, _ string) (*identity.User, error) { return user, nil },
		}
		rr := do(newTestRouter(repo, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/login",
			map[string]any{"email": user.Email, "password": "password123"},
			nil,
		)
		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("400 on missing fields", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/login",
			map[string]any{"email": "test@example.com"}, // missing password
			nil,
		)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("401 on invalid credentials", func(t *testing.T) {
		t.Parallel()
		// getByEmail defaults to ErrUserNotFound
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/login",
			map[string]any{"email": "nobody@example.com", "password": "password123"},
			nil,
		)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})
}

// --- Refresh ---

func TestHandler_Refresh(t *testing.T) {
	t.Parallel()

	t.Run("200 on valid refresh token", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			validateRefreshToken: func(_ context.Context, _ string) (uuid.UUID, error) { return user.ID, nil },
			getByID:              func(_ context.Context, _ uuid.UUID) (*identity.User, error) { return user, nil },
		}
		rr := do(newTestRouter(repo, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/refresh",
			map[string]any{"refresh_token": "valid-token"},
			nil,
		)
		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("400 on missing refresh_token field", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/refresh",
			map[string]any{},
			nil,
		)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("401 on invalid refresh token", func(t *testing.T) {
		t.Parallel()
		// validateRefreshToken defaults to ErrInvalidToken
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/refresh",
			map[string]any{"refresh_token": "bad-token"},
			nil,
		)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})
}

// --- Logout ---

func TestHandler_Logout(t *testing.T) {
	t.Parallel()

	t.Run("204 on valid request", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/logout",
			map[string]any{"refresh_token": "some-token"},
			nil,
		)
		assert.Equal(t, http.StatusNoContent, rr.Code)
	})

	t.Run("400 on missing refresh_token field", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/logout",
			map[string]any{},
			nil,
		)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}

// --- AuthMiddleware ---

func TestHandler_AuthMiddleware(t *testing.T) {
	t.Parallel()

	t.Run("allows request with a valid token", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			getByID: func(_ context.Context, _ uuid.UUID) (*identity.User, error) { return user, nil },
		}
		rr := do(newTestRouter(repo, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/resend-verification",
			nil, map[string]string{"Authorization": bearerToken(user.ID)},
		)
		assert.NotEqual(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("401 on missing Authorization header", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/resend-verification",
			nil, nil,
		)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("401 on malformed Authorization header", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/resend-verification",
			nil, map[string]string{"Authorization": "NotBearer sometoken"},
		)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("401 on token signed with wrong secret", func(t *testing.T) {
		t.Parallel()
		token, _ := NewJWTService("wrong-secret-that-is-also-at-least-32chars!").GenerateAccessToken(uuid.New())
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/resend-verification",
			nil, map[string]string{"Authorization": fmt.Sprintf("Bearer %s", token)},
		)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})
}

// --- VerifyEmail ---

func TestHandler_VerifyEmail(t *testing.T) {
	t.Parallel()

	t.Run("200 on valid token", func(t *testing.T) {
		t.Parallel()
		repo := &mockRepository{
			validateAuthToken: func(_ context.Context, _, _ string) (uuid.UUID, error) { return uuid.New(), nil },
		}
		rr := do(newTestRouter(repo, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/verify-email",
			map[string]any{"token": "valid-token"},
			nil,
		)
		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("400 on invalid token", func(t *testing.T) {
		t.Parallel()
		// validateAuthToken defaults to ErrInvalidToken
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/verify-email",
			map[string]any{"token": "bad-token"},
			nil,
		)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}

// --- ForgotPassword ---

func TestHandler_ForgotPassword(t *testing.T) {
	t.Parallel()

	t.Run("200 regardless of whether the email exists", func(t *testing.T) {
		t.Parallel()
		// getByEmail defaults to ErrUserNotFound — must still return 200
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/forgot-password",
			map[string]any{"email": "nobody@example.com"},
			nil,
		)
		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("400 on invalid email format", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/forgot-password",
			map[string]any{"email": "not-an-email"},
			nil,
		)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}

// --- ResetPassword ---

func TestHandler_ResetPassword(t *testing.T) {
	t.Parallel()

	t.Run("200 on valid token and new password", func(t *testing.T) {
		t.Parallel()
		repo := &mockRepository{
			validateAuthToken: func(_ context.Context, _, _ string) (uuid.UUID, error) { return uuid.New(), nil },
		}
		rr := do(newTestRouter(repo, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/reset-password",
			map[string]any{"token": "valid-token", "password": "newpassword123"},
			nil,
		)
		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("400 on invalid reset token", func(t *testing.T) {
		t.Parallel()
		// validateAuthToken defaults to ErrInvalidToken
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/reset-password",
			map[string]any{"token": "bad-token", "password": "newpassword123"},
			nil,
		)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}

// --- ResendVerification ---

func TestHandler_ResendVerification(t *testing.T) {
	t.Parallel()

	t.Run("200 on authenticated request for unverified user", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			getByID: func(_ context.Context, _ uuid.UUID) (*identity.User, error) { return user, nil },
		}
		rr := do(newTestRouter(repo, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/resend-verification",
			nil, map[string]string{"Authorization": bearerToken(user.ID)},
		)
		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("401 without authentication", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/resend-verification",
			nil, nil,
		)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})
}

// --- CreateAppSwitchToken ---

func TestHandler_CreateAppSwitchToken(t *testing.T) {
	t.Parallel()

	t.Run("200 returns a token on authenticated request", func(t *testing.T) {
		t.Parallel()
		userID := uuid.New()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/app-switch-token",
			nil, map[string]string{"Authorization": bearerToken(userID)},
		)
		assert.Equal(t, http.StatusOK, rr.Code)
		var resp map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
		assert.NotEmpty(t, resp["token"])
	})

	t.Run("401 without authentication", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/app-switch-token",
			nil, nil,
		)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})
}

// --- ExchangeAppSwitchToken ---

func TestHandler_ExchangeAppSwitchToken(t *testing.T) {
	t.Parallel()

	t.Run("200 on valid switch token", func(t *testing.T) {
		t.Parallel()
		user := testUser()
		repo := &mockRepository{
			validateAuthTokenWithIP: func(_ context.Context, _, _, _ string) (uuid.UUID, error) {
				return user.ID, nil
			},
			getByID: func(_ context.Context, _ uuid.UUID) (*identity.User, error) { return user, nil },
		}
		rr := do(newTestRouter(repo, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/exchange-app-switch-token",
			map[string]any{"token": "valid-switch-token"},
			nil,
		)
		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("400 on invalid switch token", func(t *testing.T) {
		t.Parallel()
		// validateAuthTokenWithIP defaults to ErrInvalidToken
		rr := do(newTestRouter(&mockRepository{}, &mockMailProvider{}), http.MethodPost, "/api/v1/auth/exchange-app-switch-token",
			map[string]any{"token": "bad-token"},
			nil,
		)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}
