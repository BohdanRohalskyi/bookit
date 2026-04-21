package catalog

import (
	"errors"
	"log/slog"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// contextKeyUserID must match the key set by the auth middleware.
// After the int64 migration, the context stores int64 (not uuid.UUID).
const contextKeyUserID = "userID"

const maxLogoSize = 5 << 20 // 5 MB

var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// Handler holds the catalog service and exposes Gin handler methods.
type Handler struct {
	service *Service
	repo    *Repository // needed to resolve UUID path params → int64
}

func NewHandler(service *Service, repo *Repository) *Handler {
	return &Handler{service: service, repo: repo}
}

// ─── Response types ────────────────────────────────────────────────────────────

type BusinessResponse struct {
	ID          string  `json:"id"`
	ProviderID  string  `json:"provider_id"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Description *string `json:"description"`
	LogoURL     *string `json:"logo_url"`
	IsActive    bool    `json:"is_active"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type BusinessListResponse struct {
	Data       []BusinessResponse `json:"data"`
	Pagination PaginationResponse `json:"pagination"`
}

type PaginationResponse struct {
	Total      int `json:"total"`
	Page       int `json:"page"`
	PerPage    int `json:"per_page"`
	TotalPages int `json:"total_pages"`
}

type ErrorResponse struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail"`
}

// ─── Request types ─────────────────────────────────────────────────────────────

type CreateBusinessRequest struct {
	Name        string  `json:"name"     binding:"required,min=1,max=100"`
	Category    string  `json:"category" binding:"required,oneof=beauty sport pet_care"`
	Description *string `json:"description"`
	LogoURL     *string `json:"logo_url"`
}

type UpdateBusinessRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	LogoURL     *string `json:"logo_url"`
	IsActive    *bool   `json:"is_active"`
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

// toResponse builds the JSON response from a Business. The public "id" comes from UUID.
func toResponse(b Business) BusinessResponse {
	return BusinessResponse{
		ID:          b.UUID.String(),
		ProviderID:  b.UUID.String(), // expose business UUID as provider_id placeholder; actual provider UUID would require a join
		Name:        b.Name,
		Category:    b.Category,
		Description: b.Description,
		LogoURL:     b.LogoURL,
		IsActive:    b.IsActive,
		CreatedAt:   b.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt:   b.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func (h *Handler) userID(c *gin.Context) (int64, bool) {
	v, exists := c.Get(contextKeyUserID)
	if !exists {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok
}

// businessIntID parses :id path param as UUID and resolves it to internal int64.
func (h *Handler) businessIntID(c *gin.Context) (int64, bool) {
	businessUUID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return 0, false
	}
	b, err := h.repo.GetByUUID(c.Request.Context(), businessUUID)
	if err != nil {
		return 0, false
	}
	return b.ID, true
}

func errResp(c *gin.Context, status int, slug, title, detail string) {
	c.JSON(status, ErrorResponse{
		Type:   "https://bookit.app/errors/" + slug,
		Title:  title,
		Status: status,
		Detail: detail,
	})
}

func ceilDiv(a, b int) int {
	if b == 0 {
		return 0
	}
	return (a + b - 1) / b
}

// ─── Handlers ──────────────────────────────────────────────────────────────────

func (h *Handler) ListBusinesses(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))         //nolint:errcheck
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20")) //nolint:errcheck
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	businesses, total, err := h.service.ListBusinesses(c.Request.Context(), userID, page, perPage)
	if err != nil {
		if errors.Is(err, ErrNotProvider) {
			c.JSON(http.StatusOK, BusinessListResponse{
				Data:       []BusinessResponse{},
				Pagination: PaginationResponse{Total: 0, Page: page, PerPage: perPage, TotalPages: 0},
			})
			return
		}
		slog.Error("list businesses", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	items := make([]BusinessResponse, len(businesses))
	for i, b := range businesses {
		items[i] = toResponse(b)
	}
	c.JSON(http.StatusOK, BusinessListResponse{
		Data: items,
		Pagination: PaginationResponse{
			Total:      total,
			Page:       page,
			PerPage:    perPage,
			TotalPages: ceilDiv(total, perPage),
		},
	})
}

func (h *Handler) CreateBusiness(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	var req CreateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}

	b, err := h.service.CreateBusiness(c.Request.Context(), userID, BusinessCreate(req))
	if err != nil {
		if errors.Is(err, ErrNotProvider) {
			errResp(c, http.StatusForbidden, "provider-required", "Provider Required", "Only providers can create businesses")
			return
		}
		slog.Error("create business", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusCreated, toResponse(b))
}

func (h *Handler) GetBusiness(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.businessIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Business ID must be a valid UUID")
		return
	}

	b, err := h.service.GetBusiness(c.Request.Context(), id, userID)
	if err != nil {
		switch {
		case errors.Is(err, ErrBusinessNotFound):
			errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
		case errors.Is(err, ErrNotOwner), errors.Is(err, ErrNotProvider):
			errResp(c, http.StatusForbidden, "forbidden", "Forbidden", "You do not own this business")
		default:
			slog.Error("get business", "error", err)
			errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, toResponse(b))
}

func (h *Handler) UpdateBusiness(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.businessIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Business ID must be a valid UUID")
		return
	}

	var req UpdateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}

	b, err := h.service.UpdateBusiness(c.Request.Context(), id, userID, BusinessUpdate(req))
	if err != nil {
		switch {
		case errors.Is(err, ErrBusinessNotFound):
			errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
		case errors.Is(err, ErrNotOwner), errors.Is(err, ErrNotProvider):
			errResp(c, http.StatusForbidden, "forbidden", "Forbidden", "You do not own this business")
		default:
			slog.Error("update business", "error", err)
			errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, toResponse(b))
}

func (h *Handler) DeleteBusiness(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.businessIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Business ID must be a valid UUID")
		return
	}

	if err := h.service.DeleteBusiness(c.Request.Context(), id, userID); err != nil {
		switch {
		case errors.Is(err, ErrBusinessNotFound):
			errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
		case errors.Is(err, ErrNotOwner), errors.Is(err, ErrNotProvider):
			errResp(c, http.StatusForbidden, "forbidden", "Forbidden", "You do not own this business")
		default:
			slog.Error("delete business", "error", err)
			errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		}
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) UploadLogo(c *gin.Context) {
	userID, ok := h.userID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.businessIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Business ID must be a valid UUID")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "file field is required")
		return
	}
	defer file.Close() //nolint:errcheck

	if header.Size > maxLogoSize {
		errResp(c, http.StatusBadRequest, "file-too-large", "File Too Large", "Logo must be smaller than 5 MB")
		return
	}

	contentType := header.Header.Get("Content-Type")
	contentType = strings.SplitN(contentType, ";", 2)[0]
	ext, allowed := allowedImageTypes[contentType]
	if !allowed {
		ext = strings.ToLower(filepath.Ext(header.Filename))
		switch ext {
		case ".jpg", ".jpeg":
			contentType, ext = "image/jpeg", ".jpg"
		case ".png":
			contentType = "image/png"
		case ".webp":
			contentType = "image/webp"
		default:
			errResp(c, http.StatusBadRequest, "invalid-file-type", "Invalid File Type", "Logo must be JPEG, PNG, or WebP")
			return
		}
	}

	b, err := h.service.UploadLogo(c.Request.Context(), id, userID, file, contentType, ext)
	if err != nil {
		switch {
		case errors.Is(err, ErrStorageNotConfigured):
			errResp(c, http.StatusServiceUnavailable, "storage-unavailable", "Storage Unavailable", "Logo upload is not available in this environment")
		case errors.Is(err, ErrBusinessNotFound):
			errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
		case errors.Is(err, ErrNotOwner), errors.Is(err, ErrNotProvider):
			errResp(c, http.StatusForbidden, "forbidden", "Forbidden", "You do not own this business")
		default:
			slog.Error("upload logo", "error", err)
			errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, toResponse(b))
}
