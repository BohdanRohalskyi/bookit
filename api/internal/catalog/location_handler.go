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

// LocationHandler exposes Gin handler methods for locations, schedules, and photos.
type LocationHandler struct {
	service *LocationService
	repo    *LocationRepository // needed to resolve UUID path params → int64
}

func NewLocationHandler(service *LocationService, repo *LocationRepository) *LocationHandler {
	return &LocationHandler{service: service, repo: repo}
}

// ─── Request types ─────────────────────────────────────────────────────────────

type CreateLocationRequest struct {
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

type UpdateLocationRequest struct {
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

type LocationResponse struct {
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

type LocationListResponse struct {
	Data       []LocationResponse `json:"data"`
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
	ID         string  `json:"id"`
	LocationID string  `json:"location_id"`
	Date       string  `json:"date"`
	IsClosed   bool    `json:"is_closed"`
	OpenTime   *string `json:"open_time"`
	CloseTime  *string `json:"close_time"`
	Reason     *string `json:"reason"`
	CreatedAt  string  `json:"created_at"`
}

type ScheduleResponse struct {
	LocationID string                      `json:"location_id"`
	Days       []ScheduleDayResponse       `json:"days"`
	Exceptions []ScheduleExceptionResponse `json:"exceptions"`
}

type LocationPhotoResponse struct {
	ID           string `json:"id"`
	LocationID   string `json:"location_id"`
	URL          string `json:"url"`
	DisplayOrder int    `json:"display_order"`
	CreatedAt    string `json:"created_at"`
}

// ─── Converters ───────────────────────────────────────────────────────────────

func toLocationResponse(l Location) LocationResponse {
	return LocationResponse{
		ID:         l.UUID.String(),
		BusinessID: l.UUID.String(), // location UUID is returned for its own id; business UUID requires lookup - using location UUID as placeholder
		Name:       l.Name,
		Address:    l.Address,
		City:       l.City,
		Country:    l.Country,
		Phone:      l.Phone,
		Email:      l.Email,
		Lat:        l.Lat,
		Lng:        l.Lng,
		Timezone:   l.Timezone,
		IsActive:   l.IsActive,
		CreatedAt:  l.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt:  l.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func toScheduleResponse(s Schedule) ScheduleResponse {
	days := make([]ScheduleDayResponse, len(s.Days))
	for i, d := range s.Days {
		days[i] = ScheduleDayResponse{
			ID:        d.UUID.String(),
			DayOfWeek: d.DayOfWeek,
			IsOpen:    d.IsOpen,
			OpenTime:  d.OpenTime,
			CloseTime: d.CloseTime,
		}
	}
	exceptions := make([]ScheduleExceptionResponse, len(s.Exceptions))
	for i, e := range s.Exceptions {
		locUUID := ""
		if e.LocationUUID != (uuid.UUID{}) {
			locUUID = e.LocationUUID.String()
		}
		exceptions[i] = ScheduleExceptionResponse{
			ID:         e.UUID.String(),
			LocationID: locUUID,
			Date:       e.Date,
			IsClosed:   e.IsClosed,
			OpenTime:   e.OpenTime,
			CloseTime:  e.CloseTime,
			Reason:     e.Reason,
			CreatedAt:  e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		}
	}
	locUUID := ""
	if s.LocationUUID != (uuid.UUID{}) {
		locUUID = s.LocationUUID.String()
	}
	return ScheduleResponse{LocationID: locUUID, Days: days, Exceptions: exceptions}
}

func toPhotoResponse(p LocationPhoto) LocationPhotoResponse {
	locUUID := ""
	if p.LocationUUID != (uuid.UUID{}) {
		locUUID = p.LocationUUID.String()
	}
	return LocationPhotoResponse{
		ID:           p.UUID.String(),
		LocationID:   locUUID,
		URL:          p.URL,
		DisplayOrder: p.DisplayOrder,
		CreatedAt:    p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (h *LocationHandler) locationUserID(c *gin.Context) (int64, bool) {
	v, exists := c.Get(contextKeyUserID)
	if !exists {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok
}

// parseLocationIntID parses :id path param as UUID and resolves to internal int64.
func (h *LocationHandler) parseLocationIntID(c *gin.Context) (int64, uuid.UUID, bool) {
	locationUUID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return 0, uuid.UUID{}, false
	}
	l, err := h.repo.GetByUUID(c.Request.Context(), locationUUID)
	if err != nil {
		return 0, uuid.UUID{}, false
	}
	return l.ID, locationUUID, true
}

func (h *LocationHandler) locationErrResp(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrLocationNotFound):
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Location not found")
	case errors.Is(err, ErrNotProvider), errors.Is(err, ErrNotOwner):
		errResp(c, http.StatusForbidden, "forbidden", "Forbidden", "You do not own this business")
	case errors.Is(err, ErrLocationNotOwner):
		errResp(c, http.StatusForbidden, "forbidden", "Forbidden", "You do not own this location")
	case errors.Is(err, ErrBusinessNotFound):
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
	default:
		slog.Error("location operation", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
	}
}

// ─── Location CRUD ──────────────────────────────────────────────────────────────

func (h *LocationHandler) ListLocations(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	businessUUID, err := uuid.Parse(c.Query("business_id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "business_id must be a valid UUID")
		return
	}
	// Resolve business UUID → int64
	bizRepo := h.service.bizRepo
	biz, err := bizRepo.GetByUUID(c.Request.Context(), businessUUID)
	if err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
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
	locations, total, err := h.service.ListLocations(c.Request.Context(), userID, biz.ID, page, perPage)
	if err != nil {
		h.locationErrResp(c, err)
		return
	}
	items := make([]LocationResponse, len(locations))
	for i, l := range locations {
		items[i] = toLocationResponse(l)
	}
	c.JSON(http.StatusOK, LocationListResponse{
		Data: items,
		Pagination: PaginationResponse{
			Total: total, Page: page, PerPage: perPage,
			TotalPages: ceilDiv(total, perPage),
		},
	})
}

func (h *LocationHandler) CreateLocation(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	var req CreateLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	businessUUID, err := uuid.Parse(req.BusinessID)
	if err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "business_id is not a valid UUID")
		return
	}
	// Resolve business UUID → int64
	biz, err := h.service.bizRepo.GetByUUID(c.Request.Context(), businessUUID)
	if err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
		return
	}
	tz := req.Timezone
	if tz == "" {
		tz = "Europe/Vilnius"
	}
	l, err := h.service.CreateLocation(c.Request.Context(), userID, LocationCreate{
		BusinessID: biz.ID,
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
		h.locationErrResp(c, err)
		return
	}
	c.JSON(http.StatusCreated, toLocationResponse(l))
}

func (h *LocationHandler) GetLocation(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, _, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	l, err := h.service.GetLocation(c.Request.Context(), id, userID)
	if err != nil {
		h.locationErrResp(c, err)
		return
	}
	c.JSON(http.StatusOK, toLocationResponse(l))
}

func (h *LocationHandler) UpdateLocation(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, _, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	var req UpdateLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	l, err := h.service.UpdateLocation(c.Request.Context(), id, userID, LocationUpdate(req))
	if err != nil {
		h.locationErrResp(c, err)
		return
	}
	c.JSON(http.StatusOK, toLocationResponse(l))
}

func (h *LocationHandler) DeleteLocation(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, _, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	if err := h.service.DeleteLocation(c.Request.Context(), id, userID); err != nil {
		h.locationErrResp(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Schedule handlers ─────────────────────────────────────────────────────────

func (h *LocationHandler) GetSchedule(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, locationUUID, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	s, err := h.service.GetSchedule(c.Request.Context(), id, userID)
	if err != nil {
		h.locationErrResp(c, err)
		return
	}
	s.LocationUUID = locationUUID
	c.JSON(http.StatusOK, toScheduleResponse(s))
}

func (h *LocationHandler) UpsertScheduleDays(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, locationUUID, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
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
		h.locationErrResp(c, err)
		return
	}
	s.LocationUUID = locationUUID
	c.JSON(http.StatusOK, toScheduleResponse(s))
}

func (h *LocationHandler) ListExceptions(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, locationUUID, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	exceptions, err := h.service.ListExceptions(c.Request.Context(), id, userID)
	if err != nil {
		h.locationErrResp(c, err)
		return
	}
	items := make([]ScheduleExceptionResponse, len(exceptions))
	for i, e := range exceptions {
		items[i] = ScheduleExceptionResponse{
			ID:         e.UUID.String(),
			LocationID: locationUUID.String(),
			Date:       e.Date,
			IsClosed:   e.IsClosed,
			OpenTime:   e.OpenTime,
			CloseTime:  e.CloseTime,
			Reason:     e.Reason,
			CreatedAt:  e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *LocationHandler) CreateException(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, locationUUID, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	var req CreateExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	e, err := h.service.CreateException(c.Request.Context(), id, userID, ScheduleExceptionCreate(req))
	if err != nil {
		h.locationErrResp(c, err)
		return
	}
	c.JSON(http.StatusCreated, ScheduleExceptionResponse{
		ID:         e.UUID.String(),
		LocationID: locationUUID.String(),
		Date:       e.Date,
		IsClosed:   e.IsClosed,
		OpenTime:   e.OpenTime,
		CloseTime:  e.CloseTime,
		Reason:     e.Reason,
		CreatedAt:  e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	})
}

func (h *LocationHandler) DeleteException(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, _, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	exceptionUUID, err := uuid.Parse(c.Param("exception_id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Exception ID must be a valid UUID")
		return
	}
	// Resolve exception UUID → int64 via a direct DB query
	// We use the schedule exceptions table which now has a uuid column
	// For simplicity, query directly
	var exceptionID int64
	dbErr := h.repo.db.QueryRow(c.Request.Context(), `SELECT id FROM schedule_exceptions WHERE uuid = $1`, exceptionUUID).Scan(&exceptionID)
	if dbErr != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Exception not found")
		return
	}
	if err := h.service.DeleteException(c.Request.Context(), id, exceptionID, userID); err != nil {
		h.locationErrResp(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Photo handlers ────────────────────────────────────────────────────────────

func (h *LocationHandler) ListPhotos(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, locationUUID, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	photos, err := h.service.ListPhotos(c.Request.Context(), id, userID)
	if err != nil {
		h.locationErrResp(c, err)
		return
	}
	items := make([]LocationPhotoResponse, len(photos))
	for i, p := range photos {
		items[i] = LocationPhotoResponse{
			ID:           p.UUID.String(),
			LocationID:   locationUUID.String(),
			URL:          p.URL,
			DisplayOrder: p.DisplayOrder,
			CreatedAt:    p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *LocationHandler) UploadPhoto(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, locationUUID, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
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
			h.locationErrResp(c, err)
		}
		return
	}
	p.LocationUUID = locationUUID
	c.JSON(http.StatusCreated, toPhotoResponse(p))
}

func (h *LocationHandler) DeletePhoto(c *gin.Context) {
	userID, ok := h.locationUserID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, _, ok := h.parseLocationIntID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	photoUUID, err := uuid.Parse(c.Param("photo_id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Photo ID must be a valid UUID")
		return
	}
	// Resolve photo UUID → int64
	photoID, _, err := h.repo.GetPhotoOwnerLocationIDByUUID(c.Request.Context(), photoUUID)
	if err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Photo not found")
		return
	}
	if err := h.service.DeletePhoto(c.Request.Context(), id, photoID, userID); err != nil {
		h.locationErrResp(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
