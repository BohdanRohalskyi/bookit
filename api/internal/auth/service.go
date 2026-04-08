package auth

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
	"github.com/BohdanRohalskyi/bookit/api/internal/mail"
)

var (
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrEmailAlreadyVerified = errors.New("email already verified")
)

const (
	bcryptCost                   = 12
	EmailVerificationTokenExpiry = 24 * time.Hour
	PasswordResetTokenExpiry     = 1 * time.Hour
	AppSwitchTokenExpiry         = 5 * time.Minute
)

type Service struct {
	repo      *identity.Repository
	jwt       *JWTService
	mail      mail.Provider
	templates *mail.Templates
}

func NewService(repo *identity.Repository, jwtSecret string, mailProvider mail.Provider, templates *mail.Templates) *Service {
	return &Service{
		repo:      repo,
		jwt:       NewJWTService(jwtSecret),
		mail:      mailProvider,
		templates: templates,
	}
}

type AuthResponse struct {
	User   identity.UserResponse `json:"user"`
	Tokens TokensResponse        `json:"tokens"`
}

type TokensResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

func (s *Service) Register(ctx context.Context, email, password, name, phone string) (*AuthResponse, error) {
	// Check if email exists
	_, err := s.repo.GetByEmail(ctx, email)
	if err == nil {
		return nil, identity.ErrEmailExists
	}
	if !errors.Is(err, identity.ErrUserNotFound) {
		return nil, err
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user, err := s.repo.Create(ctx, email, string(hash), name, phone)
	if err != nil {
		return nil, err
	}

	// Send verification email (non-blocking - don't fail registration if email fails)
	// Use a detached context so the email sends even if the request is canceled
	go func(bgCtx context.Context) {
		token, err := s.CreateEmailVerificationToken(bgCtx, user.ID)
		if err != nil {
			slog.Error("failed to create verification token", "error", err, "user_id", user.ID)
			return
		}
		msg := s.templates.EmailVerification(user.Email, token)
		if err := s.mail.Send(bgCtx, msg); err != nil {
			slog.Error("failed to send verification email", "error", err, "user_id", user.ID)
		} else {
			slog.Info("verification email sent", "user_id", user.ID, "email", user.Email)
		}
	}(context.WithoutCancel(ctx))

	// Generate tokens
	return s.generateAuthResponse(ctx, user, false)
}

func (s *Service) Login(ctx context.Context, email, password string) (*AuthResponse, error) {
	user, err := s.repo.GetByEmail(ctx, email)
	if errors.Is(err, identity.ErrUserNotFound) {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Check if provider
	isProvider, err := s.repo.IsProvider(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	return s.generateAuthResponse(ctx, user, isProvider)
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	// Validate refresh token
	userID, err := s.repo.ValidateRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, err
	}

	// Revoke old token
	if err := s.repo.RevokeRefreshToken(ctx, refreshToken); err != nil {
		return nil, err
	}

	// Get user
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Check if provider
	isProvider, err := s.repo.IsProvider(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	return s.generateAuthResponse(ctx, user, isProvider)
}

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	return s.repo.RevokeRefreshToken(ctx, refreshToken)
}

func (s *Service) ValidateToken(tokenString string) (*Claims, error) {
	return s.jwt.ValidateAccessToken(tokenString)
}

func (s *Service) generateAuthResponse(ctx context.Context, user *identity.User, isProvider bool) (*AuthResponse, error) {
	accessToken, err := s.jwt.GenerateAccessToken(user.ID)
	if err != nil {
		return nil, err
	}

	refreshToken, err := GenerateRefreshToken()
	if err != nil {
		return nil, err
	}

	expiresAt := time.Now().Add(RefreshTokenDuration)
	if err := s.repo.CreateRefreshToken(ctx, user.ID, refreshToken, expiresAt); err != nil {
		return nil, err
	}

	return &AuthResponse{
		User: user.ToResponse(isProvider),
		Tokens: TokensResponse{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			ExpiresIn:    int(AccessTokenDuration.Seconds()),
		},
	}, nil
}

// Email verification

func (s *Service) CreateEmailVerificationToken(ctx context.Context, userID uuid.UUID) (string, error) {
	token, err := GenerateRefreshToken() // reuse the random token generator
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(EmailVerificationTokenExpiry)
	if err := s.repo.CreateAuthToken(ctx, userID, token, identity.TokenTypeEmailVerification, expiresAt); err != nil {
		return "", err
	}

	return token, nil
}

func (s *Service) VerifyEmail(ctx context.Context, token string) error {
	userID, err := s.repo.ValidateAuthToken(ctx, token, identity.TokenTypeEmailVerification)
	if err != nil {
		return err
	}

	if err := s.repo.UseAuthToken(ctx, token, identity.TokenTypeEmailVerification); err != nil {
		return err
	}

	return s.repo.SetEmailVerified(ctx, userID)
}

func (s *Service) ResendVerificationEmail(ctx context.Context, userID uuid.UUID) error {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	if user.EmailVerified {
		return ErrEmailAlreadyVerified
	}

	token, err := s.CreateEmailVerificationToken(ctx, userID)
	if err != nil {
		return err
	}

	msg := s.templates.EmailVerification(user.Email, token)
	if err := s.mail.Send(ctx, msg); err != nil {
		slog.Error("failed to send verification email", "error", err, "user_id", userID)
		return err
	}

	slog.Info("verification email sent", "user_id", userID, "email", user.Email)
	return nil
}

// Password reset

func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	user, err := s.repo.GetByEmail(ctx, email)
	if errors.Is(err, identity.ErrUserNotFound) {
		// Don't reveal if email exists - silently succeed
		return nil
	}
	if err != nil {
		return err
	}

	token, err := GenerateRefreshToken()
	if err != nil {
		return err
	}

	expiresAt := time.Now().Add(PasswordResetTokenExpiry)
	if err := s.repo.CreateAuthToken(ctx, user.ID, token, identity.TokenTypePasswordReset, expiresAt); err != nil {
		return err
	}

	msg := s.templates.PasswordReset(user.Email, token)
	if err := s.mail.Send(ctx, msg); err != nil {
		slog.Error("failed to send password reset email", "error", err, "user_id", user.ID)
		// Don't return error to prevent email enumeration
		return nil
	}

	slog.Info("password reset email sent", "user_id", user.ID, "email", user.Email)
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) error {
	userID, err := s.repo.ValidateAuthToken(ctx, token, identity.TokenTypePasswordReset)
	if err != nil {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcryptCost)
	if err != nil {
		return err
	}

	if err := s.repo.UseAuthToken(ctx, token, identity.TokenTypePasswordReset); err != nil {
		return err
	}

	// Revoke all refresh tokens for security
	if err := s.repo.RevokeAllUserTokens(ctx, userID); err != nil {
		return err
	}

	return s.repo.UpdatePassword(ctx, userID, string(hash))
}

// App switch token methods

func (s *Service) CreateAppSwitchToken(ctx context.Context, userID uuid.UUID, ipAddress string) (string, error) {
	token, err := GenerateRefreshToken()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(AppSwitchTokenExpiry)
	if err := s.repo.CreateAuthTokenWithIP(ctx, userID, token, identity.TokenTypeAppSwitch, ipAddress, expiresAt); err != nil {
		return "", err
	}

	return token, nil
}

func (s *Service) ExchangeAppSwitchToken(ctx context.Context, token, ipAddress string) (*AuthResponse, error) {
	userID, err := s.repo.ValidateAuthTokenWithIP(ctx, token, identity.TokenTypeAppSwitch, ipAddress)
	if err != nil {
		return nil, err
	}

	if err := s.repo.UseAuthToken(ctx, token, identity.TokenTypeAppSwitch); err != nil {
		return nil, err
	}

	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	isProvider, err := s.repo.IsProvider(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	return s.generateAuthResponse(ctx, user, isProvider)
}
