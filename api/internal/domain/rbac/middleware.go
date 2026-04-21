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

// LocationResolver resolves a location's parent business ID and internal int64 location ID
// by looking up its public UUID.
type LocationResolver interface {
	// GetOwnerBusinessIDByUUID resolves a location UUID to its internal int64 ids.
	GetOwnerBusinessIDByUUID(ctx context.Context, locationUUID uuid.UUID) (businessID int64, locationID int64, err error)
}

// BusinessResolver resolves a business's internal int64 id from its public UUID.
type BusinessResolver interface {
	GetBusinessIntIDByUUID(ctx context.Context, businessUUID uuid.UUID) (int64, error)
}

// RequirePermission returns a Gin middleware that enforces a resource:action
// permission check for the authenticated user.
//
// It expects:
//   - "userID" (int64) in the Gin context, set by AuthMiddleware
//   - ":id" or ":business_id" path param containing the business UUID
//
// Usage:
//
//	businesses.GET("/:id", rbacSvc.RequirePermission(rbac.ResourceBusiness, rbac.ActionRead, businessResolver), handler)
func (s *Service) RequirePermission(resource, action string, resolver BusinessResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := mustUserID(c)
		if !ok {
			return
		}

		businessIDStr := c.Param("business_id")
		if businessIDStr == "" {
			businessIDStr = c.Param("id")
		}
		businessUUID, err := uuid.Parse(businessIDStr)
		if err != nil {
			slog.Error("rbac: missing or unparseable business_id in path",
				"path", c.FullPath(), "param", businessIDStr)
			abortInternalError(c)
			return
		}

		businessID, err := resolver.GetBusinessIntIDByUUID(c.Request.Context(), businessUUID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, errBody(
				http.StatusNotFound, "not-found", "Not Found", "Business not found",
			))
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

		c.Set("businessIntID", businessID)
		c.Next()
	}
}

// RequirePermissionForLocation is the variant for routes mounted under
// /locations/:id/... — it resolves the parent businessID and locationID from
// the location UUID via the provided LocationResolver, then checks the permission.
//
// On success it also stashes "businessIntID" and "locationIntID" in the Gin context
// so downstream handlers can use them without an extra DB round-trip.
func (s *Service) RequirePermissionForLocation(resource, action string, resolver LocationResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := mustUserID(c)
		if !ok {
			return
		}

		locationUUID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, errBody(
				http.StatusBadRequest, "invalid-id", "Invalid ID", "location ID must be a valid UUID",
			))
			return
		}

		businessID, locationID, err := resolver.GetOwnerBusinessIDByUUID(c.Request.Context(), locationUUID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, errBody(
				http.StatusNotFound, "not-found", "Not Found", "Location not found",
			))
			return
		}

		if err := s.CanAccess(c.Request.Context(), AccessRequest{
			UserID:     userID,
			BusinessID: businessID,
			LocationID: &locationID,
			Resource:   resource,
			Action:     action,
		}); err != nil {
			handleAccessError(c, err)
			return
		}

		c.Set("businessIntID", businessID)
		c.Set("locationIntID", locationID)
		c.Next()
	}
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func mustUserID(c *gin.Context) (int64, bool) {
	raw, exists := c.Get(contextKeyUserID)
	if !exists {
		abortForbidden(c)
		return 0, false
	}
	id, ok := raw.(int64)
	if !ok {
		abortForbidden(c)
		return 0, false
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
