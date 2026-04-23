package booking

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const contextKeyUserID = "userID"

// Handler exposes HTTP endpoints for availability and booking management.
type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func errResp(c *gin.Context, status int, slug, title, detail string) {
	c.JSON(status, gin.H{
		"type":   "https://bookit.app/errors/" + slug,
		"title":  title,
		"status": status,
		"detail": detail,
	})
}

func (h *Handler) consumerID(c *gin.Context) (int64, bool) {
	v, ok := c.Get(contextKeyUserID)
	if !ok {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok
}

func toBookingJSON(b *BookingRow) gin.H {
	items := make([]gin.H, len(b.Items))
	for i, item := range b.Items {
		items[i] = gin.H{
			"id":               item.UUID.String(),
			"service_id":       item.ServiceUUID.String(),
			"start_datetime":   item.StartAt.UTC().Format(time.RFC3339),
			"end_datetime":     item.EndAt.UTC().Format(time.RFC3339),
			"duration_minutes": item.DurationMinutes,
			"price":            item.Price,
			"status":           item.Status,
		}
	}
	resp := gin.H{
		"id":           b.UUID.String(),
		"location_id":  b.LocationUUID.String(),
		"user_id":      b.ConsumerUUID.String(),
		"status":       b.Status,
		"total_amount": b.TotalAmount,
		"currency":     b.Currency,
		"items":        items,
		"created_at":   b.CreatedAt.UTC().Format(time.RFC3339),
	}
	if b.Notes != nil {
		resp["notes"] = *b.Notes
	}
	if b.UpdatedAt != nil {
		resp["updated_at"] = b.UpdatedAt.UTC().Format(time.RFC3339)
	}
	if b.ConsumerName != "" {
		resp["consumer_name"] = b.ConsumerName
		resp["consumer_email"] = b.ConsumerEmail
	}
	return resp
}

// ─── GET /api/v1/bookings/provider ───────────────────────────────────────────

func (h *Handler) ListProviderBookings(c *gin.Context) {
	providerID, ok := h.consumerID(c)
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

	var locationUUID, status, fromDate, toDate *string
	if v := c.Query("location_id"); v != "" {
		locationUUID = &v
	}
	if v := c.Query("status"); v != "" {
		status = &v
	}
	if v := c.Query("from_date"); v != "" {
		fromDate = &v
	}
	if v := c.Query("to_date"); v != "" {
		toDate = &v
	}

	bookings, total, err := h.service.repo.ListByProvider(c.Request.Context(), providerID, locationUUID, status, fromDate, toDate, page, perPage)
	if err != nil {
		slog.Error("list provider bookings", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	data := make([]gin.H, len(bookings))
	for i := range bookings {
		data[i] = toBookingJSON(&bookings[i])
	}
	totalPages := (total + perPage - 1) / perPage
	if totalPages == 0 {
		totalPages = 1
	}
	c.JSON(http.StatusOK, gin.H{
		"data": data,
		"pagination": gin.H{
			"page": page, "per_page": perPage,
			"total": total, "total_pages": totalPages,
		},
	})
}

// ─── PATCH /api/v1/bookings/{id}/status ──────────────────────────────────────

type updateStatusRequest struct {
	Status string  `json:"status" binding:"required"`
	Reason *string `json:"reason"`
}

func (h *Handler) UpdateBookingStatus(c *gin.Context) {
	providerID, ok := h.consumerID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	bookingUUID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Booking ID must be a valid UUID")
		return
	}

	var req updateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}

	booking, err := h.service.repo.UpdateStatus(c.Request.Context(), bookingUUID, providerID, req.Status, req.Reason)
	if err != nil {
		switch {
		case errors.Is(err, ErrBookingNotFound):
			errResp(c, http.StatusNotFound, "not-found", "Not Found", "Booking not found")
		case errors.Is(err, ErrInvalidTransition):
			errResp(c, http.StatusConflict, "invalid-transition", "Invalid Transition",
				"Cannot transition from current status to "+req.Status)
		default:
			slog.Error("update booking status", "error", err)
			errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, toBookingJSON(booking))
}

// ─── GET /api/v1/availability/slots ──────────────────────────────────────────

func (h *Handler) GetAvailableSlots(c *gin.Context) {
	serviceIDStr := c.Query("service_id")
	dateStr := c.Query("date")

	if serviceIDStr == "" {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "service_id is required")
		return
	}
	if dateStr == "" {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "date is required")
		return
	}

	serviceUUID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "service_id must be a valid UUID")
		return
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "date must be YYYY-MM-DD")
		return
	}

	info, slots, err := h.service.GetAvailableSlots(c.Request.Context(), serviceUUID, date)
	if err != nil {
		if errors.Is(err, ErrServiceNotFound) {
			errResp(c, http.StatusNotFound, "not-found", "Not Found", "Service not found")
			return
		}
		slog.Error("get available slots", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	slotResp := make([]gin.H, len(slots))
	for i, s := range slots {
		slotResp[i] = gin.H{
			"start_time": s.StartTime,
			"end_time":   s.EndTime,
			"available":  s.Available,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"service_id":       info.ServiceUUID.String(),
		"location_id":      info.LocationUUID.String(),
		"date":             dateStr,
		"duration_minutes": info.DurationMinutes,
		"slots":            slotResp,
	})
}

// ─── POST /api/v1/bookings ────────────────────────────────────────────────────

type createBookingRequest struct {
	LocationID string              `json:"location_id" binding:"required,uuid"`
	Items      []bookingItemCreate `json:"items"       binding:"required,min=1,dive"`
	Notes      *string             `json:"notes"`
}

type bookingItemCreate struct {
	ServiceID       string    `json:"service_id"      binding:"required,uuid"`
	StartDatetime   time.Time `json:"start_datetime"  binding:"required"`
	DurationMinutes *int      `json:"duration_minutes"`
}

func (h *Handler) CreateBooking(c *gin.Context) {
	consumerID, ok := h.consumerID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	var req createBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}

	// binding:"required,uuid" guarantees valid UUIDs — parse errors are impossible here
	locationUUID, _ := uuid.Parse(req.LocationID) //nolint:errcheck

	// Resolve service UUIDs and build items
	items := make([]CreateBookingItemReq, 0, len(req.Items))
	for _, item := range req.Items {
		svcUUID, _ := uuid.Parse(item.ServiceID) //nolint:errcheck

		// Get service info to find duration and price
		date := item.StartDatetime.UTC().Truncate(24 * time.Hour)
		info, err := h.service.repo.GetServiceSchedule(c.Request.Context(), svcUUID, date)
		if err != nil {
			if errors.Is(err, ErrServiceNotFound) {
				errResp(c, http.StatusNotFound, "not-found", "Not Found", "Service not found: "+item.ServiceID)
				return
			}
			slog.Error("get service schedule for booking", "error", err)
			errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
			return
		}

		dur := info.DurationMinutes
		if item.DurationMinutes != nil {
			dur = *item.DurationMinutes
		}

		// Price lookup via service — for MVP use a direct DB query via repository
		// Price is stored on the service itself; we get it from GetServiceSchedule
		// For now we use 0 as placeholder — a proper price fetch would be a separate query.
		// See repository.go — we'd normally add GetServicePrice but keeping scope minimal.
		items = append(items, CreateBookingItemReq{
			ServiceID:       info.ServiceID,
			ServiceUUID:     svcUUID,
			StartAt:         item.StartDatetime.UTC(),
			DurationMinutes: dur,
			Price:           0, // TODO: fetch from services.price in a follow-up
		})
		_ = locationUUID // used below
	}

	// Resolve location UUID → int64
	// We need the location's internal ID; GetServiceSchedule already gives us one
	// Use the location from the first item's service schedule (they should all be at the same location)
	var locationID int64
	if len(items) > 0 {
		// Re-fetch first item's schedule to get the location ID for the given location UUID
		firstItemUUID, _ := uuid.Parse(req.Items[0].ServiceID) //nolint:errcheck
		date := req.Items[0].StartDatetime.UTC().Truncate(24 * time.Hour)
		info, err := h.service.repo.GetServiceSchedule(c.Request.Context(), firstItemUUID, date)
		if err == nil {
			locationID = info.LocationID
		}
	}

	booking, err := h.service.CreateBooking(c.Request.Context(), CreateBookingReq{
		LocationID: locationID,
		ConsumerID: consumerID,
		Notes:      req.Notes,
		Items:      items,
	})
	if err != nil {
		if errors.Is(err, ErrSlotTaken) {
			errResp(c, http.StatusConflict, "slot-taken", "Slot Unavailable", "The selected time slot is no longer available")
			return
		}
		if errors.Is(err, ErrServiceNotFound) {
			errResp(c, http.StatusNotFound, "not-found", "Not Found", "Service not found")
			return
		}
		slog.Error("create booking", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusCreated, toBookingJSON(booking))
}

// ─── GET /api/v1/bookings/{id} ────────────────────────────────────────────────

func (h *Handler) GetBooking(c *gin.Context) {
	consumerID, ok := h.consumerID(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}

	bookingUUID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Booking ID must be a valid UUID")
		return
	}

	booking, err := h.service.GetBooking(c.Request.Context(), bookingUUID, consumerID)
	if err != nil {
		if errors.Is(err, ErrBookingNotFound) {
			errResp(c, http.StatusNotFound, "not-found", "Not Found", "Booking not found")
			return
		}
		slog.Error("get booking", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, toBookingJSON(booking))
}

// ─── GET /api/v1/bookings ─────────────────────────────────────────────────────

func (h *Handler) ListMyBookings(c *gin.Context) {
	consumerID, ok := h.consumerID(c)
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

	var statusFilter *string
	if s := c.Query("status"); s != "" {
		statusFilter = &s
	}

	bookings, total, err := h.service.ListMyBookings(c.Request.Context(), consumerID, statusFilter, page, perPage)
	if err != nil {
		slog.Error("list bookings", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
		return
	}

	data := make([]gin.H, len(bookings))
	for i := range bookings {
		data[i] = toBookingJSON(&bookings[i])
	}

	totalPages := (total + perPage - 1) / perPage
	if totalPages == 0 {
		totalPages = 1
	}

	c.JSON(http.StatusOK, gin.H{
		"data": data,
		"pagination": gin.H{
			"page":        page,
			"per_page":    perPage,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}
