package rbac

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// contextKeyUserID must match the value set by auth.Handler.AuthMiddleware.
// Duplicated here as a string constant to avoid an import cycle.
const contextKeyUserID = "userID"

// LocationResolver resolves a location's parent business ID.
// catalog.LocationRepository satisfies this interface with no changes.
type LocationResolver interface {
	GetOwnerBusinessID(ctx context.Context, locationID uuid.UUID) (uuid.UUID, error)
}

// RequirePermission returns a Gin middleware that enforces a resource:action
// permission check for the authenticated user.
//
// It expects:
//   - "userID" (uuid.UUID) in the Gin context, set by AuthMiddleware
//   - ":id" or ":business_id" path param containing the businessID
//
// Usage:
//
//	businesses.GET("/:id", rbacSvc.RequirePermission(rbac.ResourceBusiness, rbac.ActionRead), handler)
func (s *Service) RequirePermission(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := mustUserID(c)
		if !ok {
			return
		}

		businessIDStr := c.Param("business_id")
		if businessIDStr == "" {
			businessIDStr = c.Param("id")
		}
		businessID, err := uuid.Parse(businessIDStr)
		if err != nil {
			slog.Error("rbac: missing or unparseable business_id in path",
				"path", c.FullPath(), "param", businessIDStr)
			abortInternalError(c)
			return
		}

		if err := s.CanAccess(c.Request.Context(), AccessRequest{
			UserID:     userID,
			BusinessID: businessID,
			Resource:   resource,
			Action:     action,
		}); err != nil {
			handleAccessError(c, err)
			return
		}

		c.Next()
	}
}

// RequirePermissionForLocation is the variant for routes mounted under
// /locations/:id/... — it resolves the parent businessID from the location ID
// via the provided LocationResolver, then checks the permission.
//
// On success it also stashes "businessID" in the Gin context so downstream
// handlers can use it without an extra DB round-trip.
func (s *Service) RequirePermissionForLocation(resource, action string, resolver LocationResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := mustUserID(c)
		if !ok {
			return
		}

		locationID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, errBody(
				http.StatusBadRequest, "invalid-id", "Invalid ID", "location ID must be a valid UUID",
			))
			return
		}

		businessID, err := resolver.GetOwnerBusinessID(c.Request.Context(), locationID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, errBody(
				http.StatusNotFound, "not-found", "Not Found", "Location not found",
			))
			return
		}

		lid := locationID
		if err := s.CanAccess(c.Request.Context(), AccessRequest{
			UserID:     userID,
			BusinessID: businessID,
			LocationID: &lid,
			Resource:   resource,
			Action:     action,
		}); err != nil {
			handleAccessError(c, err)
			return
		}

		c.Set("businessID", businessID)
		c.Next()
	}
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func mustUserID(c *gin.Context) (uuid.UUID, bool) {
	raw, exists := c.Get(contextKeyUserID)
	if !exists {
		abortForbidden(c)
		return uuid.Nil, false
	}
	id, ok := raw.(uuid.UUID)
	if !ok {
		abortForbidden(c)
		return uuid.Nil, false
	}
	return id, true
}

func handleAccessError(c *gin.Context, err error) {
	if errors.Is(err, ErrAccessDenied) {
		abortForbidden(c)
		return
	}
	slog.Error("rbac: CanAccess error", "error", err)
	abortInternalError(c)
}

func abortForbidden(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusForbidden, errBody(
		http.StatusForbidden,
		"forbidden",
		"Forbidden",
		"You do not have permission to perform this action",
	))
}

func abortInternalError(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusInternalServerError, errBody(
		http.StatusInternalServerError,
		"internal-error",
		"Internal Error",
		"An unexpected error occurred",
	))
}

func errBody(status int, slug, title, detail string) gin.H {
	return gin.H{
		"type":   "https://bookit.app/errors/" + slug,
		"title":  title,
		"status": status,
		"detail": detail,
	}
}
