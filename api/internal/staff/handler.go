package staff

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
)

const contextKeyUserID = "userID"

// Handler exposes Gin handler methods for staff management and user memberships.
type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ─── Request / response types ─────────────────────────────────────────────────

type InviteRequest struct {
	Email      string     `json:"email"      binding:"required,email,max=255"`
	FullName   string     `json:"full_name"  binding:"required,max=255"`
	Role       string     `json:"role"       binding:"required,oneof=administrator staff"`
	LocationID *uuid.UUID `json:"location_id"`
}

type RegisterAndAcceptRequest struct {
	Password string `json:"password"   binding:"required,min=8,max=128"`
	FullName string `json:"full_name"  binding:"max=255"`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (h *Handler) userID(c *gin.Context) (uuid.UUID, bool) {
	raw, exists := c.Get(contextKeyUserID)
	if !exists {
		return uuid.Nil, false
	}
	id, ok := raw.(uuid.UUID)
	return id, ok
}

func errResp(c *gin.Context, status int, slug, title, detail string) {
	c.JSON(status, gin.H{
		"type":   "https://bookit.app/errors/" + slug,
		"title":  title,
		"status": status,
		"detail": detail,
	})
}

// ─── GET /api/v1/me/memberships ───────────────────────────────────────────────

func (h *Handler) GetMemberships(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	resp, err := h.service.GetMemberships(c.Request.Context(), userID)
	if err != nil {
		slog.Error("get memberships", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ─── GET /api/v1/businesses/:id/members ──────────────────────────────────────

func (h *Handler) ListMembers(c *gin.Context) {
	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Business ID must be a valid UUID")
		return
	}

	members, err := h.service.ListMembers(c.Request.Context(), businessID)
	if err != nil {
		slog.Error("list members", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": members})
}

// ─── POST /api/v1/businesses/:id/members/invite ───────────────────────────────

func (h *Handler) InviteMember(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Business ID must be a valid UUID")
		return
	}

	var req InviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}

	err = h.service.InviteMember(c.Request.Context(), InviteMemberInput{
		Email:      req.Email,
		FullName:   req.FullName,
		RoleSlug:   req.Role,
		BusinessID: businessID,
		LocationID: req.LocationID,
		InvitedBy:  userID,
	})
	if err != nil {
		slog.Error("invite member", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.Status(http.StatusNoContent)
}

// ─── DELETE /api/v1/businesses/:id/members/:memberId ─────────────────────────

func (h *Handler) RemoveMember(c *gin.Context) {
	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Business ID must be a valid UUID")
		return
	}

	memberID, err := uuid.Parse(c.Param("memberId"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Member ID must be a valid UUID")
		return
	}

	err = h.service.RemoveMember(c.Request.Context(), memberID, businessID)
	if errors.Is(err, ErrMemberNotFound) {
		err = h.service.CancelInvite(c.Request.Context(), memberID, businessID)
	}

	if errors.Is(err, ErrMemberNotFound) || errors.Is(err, ErrInviteNotFound) {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Member not found")
		return
	}
	if err != nil {
		slog.Error("remove member", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.Status(http.StatusNoContent)
}

// ─── GET /api/v1/invites/:token ───────────────────────────────────────────────

func (h *Handler) PreviewInvite(c *gin.Context) {
	token := c.Param("token")

	inv, err := h.service.PreviewInvite(c.Request.Context(), token)
	if errors.Is(err, ErrInviteNotFound) {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Invite not found or has expired")
		return
	}
	if errors.Is(err, ErrInviteAlreadyUsed) {
		errResp(c, http.StatusGone, "invite-used", "Invite Already Used", "This invite has already been accepted")
		return
	}
	if err != nil {
		slog.Error("preview invite", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, inv)
}

// ─── POST /api/v1/invites/:token/accept ──────────────────────────────────────

func (h *Handler) AcceptInvite(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	token := c.Param("token")

	err := h.service.AcceptInvite(c.Request.Context(), token, userID)
	if errors.Is(err, ErrInviteNotFound) {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Invite not found or has expired")
		return
	}
	if errors.Is(err, ErrInviteAlreadyUsed) {
		errResp(c, http.StatusGone, "invite-used", "Invite Already Used", "This invite has already been accepted")
		return
	}
	if err != nil {
		slog.Error("accept invite", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.Status(http.StatusNoContent)
}

// ─── POST /api/v1/invites/:token/register-and-accept ─────────────────────────

func (h *Handler) RegisterAndAcceptInvite(c *gin.Context) {
	token := c.Param("token")

	var req RegisterAndAcceptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}

	result, err := h.service.RegisterAndAcceptInvite(c.Request.Context(), token, req.Password, req.FullName)
	if errors.Is(err, ErrInviteNotFound) {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Invite not found or has expired")
		return
	}
	if errors.Is(err, ErrInviteAlreadyUsed) {
		errResp(c, http.StatusGone, "invite-used", "Invite Already Used", "This invite has already been accepted")
		return
	}
	if errors.Is(err, identity.ErrEmailExists) {
		errResp(c, http.StatusConflict, "email-exists", "Email Already Registered",
			"An account with this email already exists. Please log in and accept the invite.")
		return
	}
	if err != nil {
		slog.Error("register and accept invite", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":             result.UserID,
			"email":          result.Email,
			"name":           result.Name,
			"email_verified": true,
			"is_provider":    false,
		},
		"tokens": gin.H{
			"access_token":  result.Tokens.AccessToken,
			"refresh_token": result.Tokens.RefreshToken,
			"expires_in":    result.Tokens.ExpiresIn,
		},
	})
}

// ─── GET /api/v1/businesses/:id/me/profile ───────────────────────────────────

func (h *Handler) GetMyProfile(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Business ID must be a valid UUID")
		return
	}

	profile, err := h.service.GetMyProfile(c.Request.Context(), userID, businessID)
	if errors.Is(err, ErrMemberNotFound) {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Profile not found")
		return
	}
	if err != nil {
		slog.Error("get my profile", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, profile)
}

// ─── PUT /api/v1/businesses/:id/me/profile ───────────────────────────────────

func (h *Handler) UpdateMyProfile(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Business ID must be a valid UUID")
		return
	}

	var req struct {
		FullName string `json:"full_name" binding:"required,max=255"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}

	profile, err := h.service.UpdateMyProfile(c.Request.Context(), userID, businessID, req.FullName)
	if errors.Is(err, ErrMemberNotFound) {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "You are not a member of this business")
		return
	}
	if err != nil {
		slog.Error("update my profile", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, profile)
}
