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

const maxPhotoSize = 10 << 20 // 10 MB

// BranchHandler exposes Gin handler methods for branches, schedules, and photos.
type BranchHandler struct {
	service *BranchService
}

func NewBranchHandler(service *BranchService) *BranchHandler {
	return &BranchHandler{service: service}
}

// ─── Request types ─────────────────────────────────────────────────────────────

type CreateBranchRequest struct {
	BusinessID string   `json:"business_id" binding:"required,uuid"`
	Name       string   `json:"name"        binding:"required,min=1,max=100"`
	Address    string   `json:"address"     binding:"required,max=200"`
	City       string   `json:"city"        binding:"required,max=100"`
	Country    string   `json:"country"     binding:"required,max=100"`
	Phone      *string  `json:"phone"`
	Email      *string  `json:"email"`
	Lat        *float64 `json:"lat"`
	Lng        *float64 `json:"lng"`
	Timezone   string   `json:"timezone"`
}

type UpdateBranchRequest struct {
	Name     *string  `json:"name"`
	Address  *string  `json:"address"`
	City     *string  `json:"city"`
	Country  *string  `json:"country"`
	Phone    *string  `json:"phone"`
	Email    *string  `json:"email"`
	Lat      *float64 `json:"lat"`
	Lng      *float64 `json:"lng"`
	Timezone *string  `json:"timezone"`
	IsActive *bool    `json:"is_active"`
}

type ScheduleDayInputRequest struct {
	DayOfWeek int     `json:"day_of_week" binding:"min=0,max=6"`
	IsOpen    bool    `json:"is_open"`
	OpenTime  *string `json:"open_time"`
	CloseTime *string `json:"close_time"`
}

type UpsertScheduleDaysRequest struct {
	Days []ScheduleDayInputRequest `json:"days" binding:"required"`
}

type CreateExceptionRequest struct {
	Date      string  `json:"date"      binding:"required"`
	IsClosed  bool    `json:"is_closed"`
	OpenTime  *string `json:"open_time"`
	CloseTime *string `json:"close_time"`
	Reason    *string `json:"reason"`
}

// ─── Response types ────────────────────────────────────────────────────────────

type BranchResponse struct {
	ID         string   `json:"id"`
	BusinessID string   `json:"business_id"`
	Name       string   `json:"name"`
	Address    string   `json:"address"`
	City       string   `json:"city"`
	Country    string   `json:"country"`
	Phone      *string  `json:"phone"`
	Email      *string  `json:"email"`
	Lat        *float64 `json:"lat"`
	Lng        *float64 `json:"lng"`
	Timezone   string   `json:"timezone"`
	IsActive   bool     `json:"is_active"`
	CreatedAt  string   `json:"created_at"`
	UpdatedAt  string   `json:"updated_at"`
}

type BranchListResponse struct {
	Data       []BranchResponse   `json:"data"`
	Pagination PaginationResponse `json:"pagination"`
}

type ScheduleDayResponse struct {
	ID        string  `json:"id"`
	DayOfWeek int     `json:"day_of_week"`
	IsOpen    bool    `json:"is_open"`
	OpenTime  *string `json:"open_time"`
	CloseTime *string `json:"close_time"`
}

type ScheduleExceptionResponse struct {
	ID        string  `json:"id"`
	BranchID  string  `json:"branch_id"`
	Date      string  `json:"date"`
	IsClosed  bool    `json:"is_closed"`
	OpenTime  *string `json:"open_time"`
	CloseTime *string `json:"close_time"`
	Reason    *string `json:"reason"`
	CreatedAt string  `json:"created_at"`
}

type ScheduleResponse struct {
	BranchID   string                      `json:"branch_id"`
	Days       []ScheduleDayResponse       `json:"days"`
	Exceptions []ScheduleExceptionResponse `json:"exceptions"`
}

type BranchPhotoResponse struct {
	ID           string `json:"id"`
	BranchID     string `json:"branch_id"`
	URL          string `json:"url"`
	DisplayOrder int    `json:"display_order"`
	CreatedAt    string `json:"created_at"`
}

// ─── Converters ───────────────────────────────────────────────────────────────

func toBranchResponse(b Branch) BranchResponse {
	return BranchResponse{
		ID:         b.ID.String(),
		BusinessID: b.BusinessID.String(),
		Name:       b.Name,
		Address:    b.Address,
		City:       b.City,
		Country:    b.Country,
		Phone:      b.Phone,
		Email:      b.Email,
		Lat:        b.Lat,
		Lng:        b.Lng,
		Timezone:   b.Timezone,
		IsActive:   b.IsActive,
		CreatedAt:  b.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt:  b.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func toScheduleResponse(s Schedule) ScheduleResponse {
	days := make([]ScheduleDayResponse, len(s.Days))
	for i, d := range s.Days {
		days[i] = ScheduleDayResponse{
			ID:        d.ID.String(),
			DayOfWeek: d.DayOfWeek,
			IsOpen:    d.IsOpen,
			OpenTime:  d.OpenTime,
			CloseTime: d.CloseTime,
		}
	}
	exceptions := make([]ScheduleExceptionResponse, len(s.Exceptions))
	for i, e := range s.Exceptions {
		exceptions[i] = ScheduleExceptionResponse{
			ID:        e.ID.String(),
			BranchID:  e.BranchID.String(),
			Date:      e.Date,
			IsClosed:  e.IsClosed,
			OpenTime:  e.OpenTime,
			CloseTime: e.CloseTime,
			Reason:    e.Reason,
			CreatedAt: e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		}
	}
	return ScheduleResponse{BranchID: s.BranchID.String(), Days: days, Exceptions: exceptions}
}

func toPhotoResponse(p BranchPhoto) BranchPhotoResponse {
	return BranchPhotoResponse{
		ID:           p.ID.String(),
		BranchID:     p.BranchID.String(),
		URL:          p.URL,
		DisplayOrder: p.DisplayOrder,
		CreatedAt:    p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (h *BranchHandler) branchUserID(c *gin.Context) (uuid.UUID, bool) {
	v, exists := c.Get(contextKeyUserID)
	if !exists {
		return uuid.Nil, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}

func (h *BranchHandler) parseBranchID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	return id, err == nil
}

func (h *BranchHandler) branchErrResp(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrBranchNotFound):
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Branch not found")
	case errors.Is(err, ErrBranchNotOwner), errors.Is(err, ErrNotProvider), errors.Is(err, ErrNotOwner):
		errResp(c, http.StatusForbidden, "forbidden", "Forbidden", "You do not own this branch")
	case errors.Is(err, ErrBusinessNotFound):
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
	default:
		slog.Error("branch operation", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
	}
}

// ─── Branch CRUD ──────────────────────────────────────────────────────────────

func (h *BranchHandler) ListBranches(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	businessID, err := uuid.Parse(c.Query("business_id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "business_id must be a valid UUID")
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
	branches, total, err := h.service.ListBranches(c.Request.Context(), userID, businessID, page, perPage)
	if err != nil {
		h.branchErrResp(c, err)
		return
	}
	items := make([]BranchResponse, len(branches))
	for i, b := range branches {
		items[i] = toBranchResponse(b)
	}
	c.JSON(http.StatusOK, BranchListResponse{
		Data: items,
		Pagination: PaginationResponse{
			Total: total, Page: page, PerPage: perPage,
			TotalPages: ceilDiv(total, perPage),
		},
	})
}

func (h *BranchHandler) CreateBranch(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	var req CreateBranchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	businessID, err := uuid.Parse(req.BusinessID)
	if err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "business_id is not a valid UUID")
		return
	}
	tz := req.Timezone
	if tz == "" {
		tz = "Europe/Vilnius"
	}
	b, err := h.service.CreateBranch(c.Request.Context(), userID, BranchCreate{
		BusinessID: businessID,
		Name:       req.Name,
		Address:    req.Address,
		City:       req.City,
		Country:    req.Country,
		Phone:      req.Phone,
		Email:      req.Email,
		Lat:        req.Lat,
		Lng:        req.Lng,
		Timezone:   tz,
	})
	if err != nil {
		h.branchErrResp(c, err)
		return
	}
	c.JSON(http.StatusCreated, toBranchResponse(b))
}

func (h *BranchHandler) GetBranch(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	b, err := h.service.GetBranch(c.Request.Context(), id, userID)
	if err != nil {
		h.branchErrResp(c, err)
		return
	}
	c.JSON(http.StatusOK, toBranchResponse(b))
}

func (h *BranchHandler) UpdateBranch(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	var req UpdateBranchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	b, err := h.service.UpdateBranch(c.Request.Context(), id, userID, BranchUpdate(req))
	if err != nil {
		h.branchErrResp(c, err)
		return
	}
	c.JSON(http.StatusOK, toBranchResponse(b))
}

func (h *BranchHandler) DeleteBranch(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	if err := h.service.DeleteBranch(c.Request.Context(), id, userID); err != nil {
		h.branchErrResp(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Schedule handlers ─────────────────────────────────────────────────────────

func (h *BranchHandler) GetSchedule(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	s, err := h.service.GetSchedule(c.Request.Context(), id, userID)
	if err != nil {
		h.branchErrResp(c, err)
		return
	}
	c.JSON(http.StatusOK, toScheduleResponse(s))
}

func (h *BranchHandler) UpsertScheduleDays(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	var req UpsertScheduleDaysRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	inputs := make([]ScheduleDayInput, len(req.Days))
	for i, d := range req.Days {
		inputs[i] = ScheduleDayInput(d)
	}
	s, err := h.service.UpsertScheduleDays(c.Request.Context(), id, userID, inputs)
	if err != nil {
		h.branchErrResp(c, err)
		return
	}
	c.JSON(http.StatusOK, toScheduleResponse(s))
}

func (h *BranchHandler) ListExceptions(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	exceptions, err := h.service.ListExceptions(c.Request.Context(), id, userID)
	if err != nil {
		h.branchErrResp(c, err)
		return
	}
	items := make([]ScheduleExceptionResponse, len(exceptions))
	for i, e := range exceptions {
		items[i] = ScheduleExceptionResponse{
			ID:        e.ID.String(),
			BranchID:  id.String(),
			Date:      e.Date,
			IsClosed:  e.IsClosed,
			OpenTime:  e.OpenTime,
			CloseTime: e.CloseTime,
			Reason:    e.Reason,
			CreatedAt: e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *BranchHandler) CreateException(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	var req CreateExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	e, err := h.service.CreateException(c.Request.Context(), id, userID, ScheduleExceptionCreate(req))
	if err != nil {
		h.branchErrResp(c, err)
		return
	}
	c.JSON(http.StatusCreated, ScheduleExceptionResponse{
		ID:        e.ID.String(),
		BranchID:  id.String(),
		Date:      e.Date,
		IsClosed:  e.IsClosed,
		OpenTime:  e.OpenTime,
		CloseTime: e.CloseTime,
		Reason:    e.Reason,
		CreatedAt: e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	})
}

func (h *BranchHandler) DeleteException(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	exceptionID, err := uuid.Parse(c.Param("exception_id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Exception ID must be a valid UUID")
		return
	}
	if err := h.service.DeleteException(c.Request.Context(), id, exceptionID, userID); err != nil {
		h.branchErrResp(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Photo handlers ────────────────────────────────────────────────────────────

func (h *BranchHandler) ListPhotos(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	photos, err := h.service.ListPhotos(c.Request.Context(), id, userID)
	if err != nil {
		h.branchErrResp(c, err)
		return
	}
	items := make([]BranchPhotoResponse, len(photos))
	for i, p := range photos {
		items[i] = toPhotoResponse(p)
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *BranchHandler) UploadPhoto(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "file field is required")
		return
	}
	defer file.Close() //nolint:errcheck

	if header.Size > maxPhotoSize {
		errResp(c, http.StatusBadRequest, "file-too-large", "File Too Large", "Photo must be smaller than 10 MB")
		return
	}

	contentType := strings.SplitN(header.Header.Get("Content-Type"), ";", 2)[0]
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
			errResp(c, http.StatusBadRequest, "invalid-file-type", "Invalid File Type", "Photo must be JPEG, PNG, or WebP")
			return
		}
	}

	p, err := h.service.UploadPhoto(c.Request.Context(), id, userID, file, contentType, ext)
	if err != nil {
		switch {
		case errors.Is(err, ErrStorageNotConfigured):
			errResp(c, http.StatusServiceUnavailable, "storage-unavailable", "Storage Unavailable", "Photo upload is not available in this environment")
		default:
			h.branchErrResp(c, err)
		}
		return
	}
	c.JSON(http.StatusCreated, toPhotoResponse(p))
}

func (h *BranchHandler) DeletePhoto(c *gin.Context) {
	userID, ok := h.branchUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.parseBranchID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Branch ID must be a valid UUID")
		return
	}
	photoID, err := uuid.Parse(c.Param("photo_id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Photo ID must be a valid UUID")
		return
	}
	if err := h.service.DeletePhoto(c.Request.Context(), id, photoID, userID); err != nil {
		h.branchErrResp(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
