package auth

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
)

// contextKeyUserID is the Gin context key for the authenticated user's ID.
const contextKeyUserID = "userID"

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email,max=255"`
	Password string `json:"password" binding:"required,min=8,max=72"`
	Name     string `json:"name" binding:"required,min=1,max=100"`
	Phone    string `json:"phone" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type VerifyEmailRequest struct {
	Token string `json:"token" binding:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

type ExchangeAppSwitchTokenRequest struct {
	Token string `json:"token" binding:"required"`
}

type AppSwitchTokenResponse struct {
	Token string `json:"token"`
}

type MessageResponse struct {
	Message string `json:"message"`
}

type ErrorResponse struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail"`
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "validation-error",
			Title:  "Validation Error",
			Status: http.StatusBadRequest,
			Detail: err.Error(),
		})
		return
	}

	resp, err := h.service.Register(c.Request.Context(), req.Email, req.Password, req.Name, req.Phone)
	if errors.Is(err, identity.ErrEmailExists) {
		c.JSON(http.StatusConflict, ErrorResponse{
			Type:   "email-already-exists",
			Title:  "Email Already Exists",
			Status: http.StatusConflict,
			Detail: "An account with this email already exists",
		})
		return
	}
	if err != nil {
		slog.Error("register failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Type:   "internal-error",
			Title:  "Internal Error",
			Status: http.StatusInternalServerError,
			Detail: "An unexpected error occurred",
		})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "validation-error",
			Title:  "Validation Error",
			Status: http.StatusBadRequest,
			Detail: err.Error(),
		})
		return
	}

	resp, err := h.service.Login(c.Request.Context(), req.Email, req.Password)
	if errors.Is(err, ErrInvalidCredentials) {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Type:   "invalid-credentials",
			Title:  "Invalid Credentials",
			Status: http.StatusUnauthorized,
			Detail: "Invalid email or password",
		})
		return
	}
	if err != nil {
		slog.Error("login failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Type:   "internal-error",
			Title:  "Internal Error",
			Status: http.StatusInternalServerError,
			Detail: "An unexpected error occurred",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "validation-error",
			Title:  "Validation Error",
			Status: http.StatusBadRequest,
			Detail: err.Error(),
		})
		return
	}

	resp, err := h.service.Refresh(c.Request.Context(), req.RefreshToken)
	if errors.Is(err, identity.ErrInvalidToken) {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Type:   "invalid-refresh-token",
			Title:  "Invalid Refresh Token",
			Status: http.StatusUnauthorized,
			Detail: "Invalid or expired refresh token",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Type:   "internal-error",
			Title:  "Internal Error",
			Status: http.StatusInternalServerError,
			Detail: "An unexpected error occurred",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) Logout(c *gin.Context) {
	var req LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "validation-error",
			Title:  "Validation Error",
			Status: http.StatusBadRequest,
			Detail: err.Error(),
		})
		return
	}

	// Silently succeed even if token not found (idempotent)
	_ = h.service.Logout(c.Request.Context(), req.RefreshToken) //nolint:errcheck

	c.Status(http.StatusNoContent)
}

// AuthMiddleware validates JWT from Authorization header
func (h *Handler) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, ErrorResponse{
				Type:   "unauthorized",
				Title:  "Unauthorized",
				Status: http.StatusUnauthorized,
				Detail: "Authorization header required",
			})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, ErrorResponse{
				Type:   "unauthorized",
				Title:  "Unauthorized",
				Status: http.StatusUnauthorized,
				Detail: "Invalid authorization header format",
			})
			return
		}

		claims, err := h.service.ValidateToken(parts[1])
		if errors.Is(err, ErrExpiredToken) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, ErrorResponse{
				Type:   "token-expired",
				Title:  "Token Expired",
				Status: http.StatusUnauthorized,
				Detail: "Access token has expired",
			})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, ErrorResponse{
				Type:   "unauthorized",
				Title:  "Unauthorized",
				Status: http.StatusUnauthorized,
				Detail: "Invalid access token",
			})
			return
		}

		// Store user ID in context
		c.Set(contextKeyUserID, claims.UserID)
		c.Next()
	}
}

// VerifyEmail verifies the user's email with a token
func (h *Handler) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "validation-error",
			Title:  "Validation Error",
			Status: http.StatusBadRequest,
			Detail: err.Error(),
		})
		return
	}

	err := h.service.VerifyEmail(c.Request.Context(), req.Token)
	if errors.Is(err, identity.ErrInvalidToken) {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "invalid-token",
			Title:  "Invalid Token",
			Status: http.StatusBadRequest,
			Detail: "Invalid or expired verification token",
		})
		return
	}
	if err != nil {
		slog.Error("verify email failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Type:   "internal-error",
			Title:  "Internal Error",
			Status: http.StatusInternalServerError,
			Detail: "An unexpected error occurred",
		})
		return
	}

	c.JSON(http.StatusOK, MessageResponse{Message: "Email verified successfully"})
}

// ResendVerification resends the verification email (requires auth)
func (h *Handler) ResendVerification(c *gin.Context) {
	userID, exists := c.Get(contextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Type:   "unauthorized",
			Title:  "Unauthorized",
			Status: http.StatusUnauthorized,
			Detail: "Authentication required",
		})
		return
	}

	err := h.service.ResendVerificationEmail(c.Request.Context(), userID.(uuid.UUID))
	if errors.Is(err, ErrEmailAlreadyVerified) {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "email-already-verified",
			Title:  "Email Already Verified",
			Status: http.StatusBadRequest,
			Detail: "Your email is already verified",
		})
		return
	}
	if err != nil {
		slog.Error("resend verification failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Type:   "internal-error",
			Title:  "Internal Error",
			Status: http.StatusInternalServerError,
			Detail: "An unexpected error occurred",
		})
		return
	}

	c.JSON(http.StatusOK, MessageResponse{Message: "Verification email sent"})
}

// ForgotPassword sends a password reset email
func (h *Handler) ForgotPassword(c *gin.Context) {
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "validation-error",
			Title:  "Validation Error",
			Status: http.StatusBadRequest,
			Detail: err.Error(),
		})
		return
	}

	// Always return success to prevent email enumeration
	_ = h.service.RequestPasswordReset(c.Request.Context(), req.Email) //nolint:errcheck

	c.JSON(http.StatusOK, MessageResponse{Message: "If an account exists with this email, a password reset link has been sent"})
}

// ResetPassword resets the user's password with a token
func (h *Handler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "validation-error",
			Title:  "Validation Error",
			Status: http.StatusBadRequest,
			Detail: err.Error(),
		})
		return
	}

	err := h.service.ResetPassword(c.Request.Context(), req.Token, req.Password)
	if errors.Is(err, identity.ErrInvalidToken) {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "invalid-token",
			Title:  "Invalid Token",
			Status: http.StatusBadRequest,
			Detail: "Invalid or expired reset token",
		})
		return
	}
	if err != nil {
		slog.Error("reset password failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Type:   "internal-error",
			Title:  "Internal Error",
			Status: http.StatusInternalServerError,
			Detail: "An unexpected error occurred",
		})
		return
	}

	c.JSON(http.StatusOK, MessageResponse{Message: "Password reset successfully"})
}

// CreateAppSwitchToken generates a one-time token for switching between apps (requires auth)
func (h *Handler) CreateAppSwitchToken(c *gin.Context) {
	userID, exists := c.Get(contextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Type:   "unauthorized",
			Title:  "Unauthorized",
			Status: http.StatusUnauthorized,
			Detail: "Authentication required",
		})
		return
	}

	clientIP := c.ClientIP()
	token, err := h.service.CreateAppSwitchToken(c.Request.Context(), userID.(uuid.UUID), clientIP)
	if err != nil {
		slog.Error("create app switch token failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Type:   "internal-error",
			Title:  "Internal Error",
			Status: http.StatusInternalServerError,
			Detail: "An unexpected error occurred",
		})
		return
	}

	c.JSON(http.StatusOK, AppSwitchTokenResponse{Token: token})
}

// ExchangeAppSwitchToken exchanges a one-time app switch token for a full session
func (h *Handler) ExchangeAppSwitchToken(c *gin.Context) {
	var req ExchangeAppSwitchTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "validation-error",
			Title:  "Validation Error",
			Status: http.StatusBadRequest,
			Detail: err.Error(),
		})
		return
	}

	clientIP := c.ClientIP()
	resp, err := h.service.ExchangeAppSwitchToken(c.Request.Context(), req.Token, clientIP)
	if errors.Is(err, identity.ErrInvalidToken) {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Type:   "invalid-token",
			Title:  "Invalid Token",
			Status: http.StatusBadRequest,
			Detail: "Invalid or expired app switch token",
		})
		return
	}
	if err != nil {
		slog.Error("exchange app switch token failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Type:   "internal-error",
			Title:  "Internal Error",
			Status: http.StatusInternalServerError,
			Detail: "An unexpected error occurred",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}
