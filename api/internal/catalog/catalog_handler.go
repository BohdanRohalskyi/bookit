package catalog

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CatalogHandler exposes endpoints for equipment, staff roles, services
// and location pivot management.
type CatalogItemHandler struct {
	service *CatalogService
}

func NewCatalogItemHandler(service *CatalogService) *CatalogItemHandler {
	return &CatalogItemHandler{service: service}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (h *CatalogItemHandler) uid(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get(contextKeyUserID)
	if !ok {
		return uuid.Nil, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}

func (h *CatalogItemHandler) pathID(c *gin.Context, param string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(param))
	return id, err == nil
}

func (h *CatalogItemHandler) queryUUID(c *gin.Context, key string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Query(key))
	return id, err == nil
}

func (h *CatalogItemHandler) catalogErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrEquipmentNotFound), errors.Is(err, ErrStaffRoleNotFound),
		errors.Is(err, ErrServiceNotFound), errors.Is(err, ErrLocationItemNotFound),
		errors.Is(err, ErrLocationNotFound), errors.Is(err, ErrBusinessNotFound):
		errResp(c, http.StatusNotFound, "not-found", "Not Found", err.Error())
	case errors.Is(err, ErrNotProvider), errors.Is(err, ErrNotOwner), errors.Is(err, ErrLocationNotOwner):
		errResp(c, http.StatusForbidden, "forbidden", "Forbidden", "You do not own this resource")
	default:
		slog.Error("catalog operation", "error", err)
		errResp(c, http.StatusInternalServerError, "internal-error", "Internal Error", "An unexpected error occurred")
	}
}

// ─── Equipment responses ──────────────────────────────────────────────────────

type EquipmentResponse struct {
	ID         string `json:"id"`
	BusinessID string `json:"business_id"`
	Name       string `json:"name"`
	CreatedAt  string `json:"created_at"`
}

func toEquipmentResp(e Equipment) EquipmentResponse {
	return EquipmentResponse{
		ID:         e.ID.String(),
		BusinessID: e.BusinessID.String(),
		Name:       e.Name,
		CreatedAt:  e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

// ─── Equipment handlers ───────────────────────────────────────────────────────

func (h *CatalogItemHandler) ListEquipment(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	businessID, ok := h.queryUUID(c, "business_id")
	if !ok {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "business_id must be a valid UUID")
		return
	}
	items, err := h.service.ListEquipment(c.Request.Context(), userID, businessID)
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	resp := make([]EquipmentResponse, len(items))
	for i, e := range items {
		resp[i] = toEquipmentResp(e)
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *CatalogItemHandler) CreateEquipment(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	var req struct {
		BusinessID string `json:"business_id" binding:"required,uuid"`
		Name       string `json:"name"        binding:"required,min=1,max=100"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	businessID, _ := uuid.Parse(req.BusinessID) //nolint:errcheck // binding:"uuid" already validated
	e, err := h.service.CreateEquipment(c.Request.Context(), userID, EquipmentCreate{BusinessID: businessID, Name: req.Name})
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, toEquipmentResp(e))
}

func (h *CatalogItemHandler) DeleteEquipment(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.pathID(c, "id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Equipment ID must be a valid UUID")
		return
	}
	if err := h.service.DeleteEquipment(c.Request.Context(), userID, id); err != nil {
		h.catalogErr(c, err)
		return
	}
	if err := h.service.DeleteEquipmentExec(c.Request.Context(), id); err != nil {
		h.catalogErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Staff role responses ─────────────────────────────────────────────────────

type StaffRoleResponse struct {
	ID         string `json:"id"`
	BusinessID string `json:"business_id"`
	JobTitle   string `json:"job_title"`
	CreatedAt  string `json:"created_at"`
}

func toStaffRoleResp(s StaffRole) StaffRoleResponse {
	return StaffRoleResponse{
		ID:         s.ID.String(),
		BusinessID: s.BusinessID.String(),
		JobTitle:   s.JobTitle,
		CreatedAt:  s.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

// ─── Staff role handlers ──────────────────────────────────────────────────────

func (h *CatalogItemHandler) ListStaffRoles(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	businessID, ok := h.queryUUID(c, "business_id")
	if !ok {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "business_id must be a valid UUID")
		return
	}
	items, err := h.service.ListStaffRoles(c.Request.Context(), userID, businessID)
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	resp := make([]StaffRoleResponse, len(items))
	for i, s := range items {
		resp[i] = toStaffRoleResp(s)
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *CatalogItemHandler) CreateStaffRole(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	var req struct {
		BusinessID string `json:"business_id" binding:"required,uuid"`
		JobTitle   string `json:"job_title"   binding:"required,min=1,max=100"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	businessID, _ := uuid.Parse(req.BusinessID) //nolint:errcheck // binding:"uuid" already validated
	s, err := h.service.CreateStaffRole(c.Request.Context(), userID, StaffRoleCreate{BusinessID: businessID, JobTitle: req.JobTitle})
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, toStaffRoleResp(s))
}

func (h *CatalogItemHandler) DeleteStaffRole(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.pathID(c, "id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Staff role ID must be a valid UUID")
		return
	}
	if err := h.service.DeleteStaffRole(c.Request.Context(), userID, id); err != nil {
		h.catalogErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── ServiceItem responses ────────────────────────────────────────────────────────

type ServiceEquipmentReqResponse struct {
	EquipmentID    string `json:"equipment_id"`
	EquipmentName  string `json:"equipment_name"`
	QuantityNeeded int    `json:"quantity_needed"`
}

type ServiceStaffReqResponse struct {
	StaffRoleID    string `json:"staff_role_id"`
	JobTitle       string `json:"job_title"`
	QuantityNeeded int    `json:"quantity_needed"`
}

type ServiceResponse struct {
	ID              string                        `json:"id"`
	BusinessID      string                        `json:"business_id"`
	Name            string                        `json:"name"`
	Description     *string                       `json:"description"`
	DurationMinutes int                           `json:"duration_minutes"`
	Price           float64                       `json:"price"`
	Currency        string                        `json:"currency"`
	Equipment       []ServiceEquipmentReqResponse `json:"equipment_requirements"`
	Staff           []ServiceStaffReqResponse     `json:"staff_requirements"`
	CreatedAt       string                        `json:"created_at"`
	UpdatedAt       string                        `json:"updated_at"`
}

func toServiceResp(s ServiceItem) ServiceResponse {
	eqs := make([]ServiceEquipmentReqResponse, len(s.Equipment))
	for i, e := range s.Equipment {
		eqs[i] = ServiceEquipmentReqResponse{EquipmentID: e.EquipmentID.String(), EquipmentName: e.EquipmentName, QuantityNeeded: e.QuantityNeeded}
	}
	srs := make([]ServiceStaffReqResponse, len(s.Staff))
	for i, sr := range s.Staff {
		srs[i] = ServiceStaffReqResponse{StaffRoleID: sr.StaffRoleID.String(), JobTitle: sr.JobTitle, QuantityNeeded: sr.QuantityNeeded}
	}
	return ServiceResponse{
		ID: s.ID.String(), BusinessID: s.BusinessID.String(), Name: s.Name,
		Description: s.Description, DurationMinutes: s.DurationMinutes,
		Price: s.Price, Currency: s.Currency, Equipment: eqs, Staff: srs,
		CreatedAt: s.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt: s.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

// ─── ServiceItem handlers ─────────────────────────────────────────────────────────

func (h *CatalogItemHandler) ListServices(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	businessID, ok := h.queryUUID(c, "business_id")
	if !ok {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "business_id must be a valid UUID")
		return
	}
	items, err := h.service.ListServices(c.Request.Context(), userID, businessID)
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	resp := make([]ServiceResponse, len(items))
	for i, s := range items {
		resp[i] = toServiceResp(s)
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *CatalogItemHandler) CreateService(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	var req struct {
		BusinessID      string  `json:"business_id"      binding:"required,uuid"`
		Name            string  `json:"name"             binding:"required,min=1,max=100"`
		Description     *string `json:"description"`
		DurationMinutes int     `json:"duration_minutes" binding:"required,min=1"`
		Price           float64 `json:"price"            binding:"min=0"`
		Currency        string  `json:"currency"`
		EquipmentReqs   []struct {
			EquipmentID    string `json:"equipment_id"`
			QuantityNeeded int    `json:"quantity_needed"`
		} `json:"equipment_requirements"`
		StaffReqs []struct {
			StaffRoleID    string `json:"staff_role_id"`
			QuantityNeeded int    `json:"quantity_needed"`
		} `json:"staff_requirements"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	businessID, _ := uuid.Parse(req.BusinessID) //nolint:errcheck // binding:"uuid" already validated
	cur := req.Currency
	if cur == "" {
		cur = "EUR"
	}
	create := ServiceItemCreate{
		BusinessID:      businessID,
		Name:            req.Name,
		Description:     req.Description,
		DurationMinutes: req.DurationMinutes,
		Price:           req.Price,
		Currency:        cur,
	}
	for _, e := range req.EquipmentReqs {
		id, err := uuid.Parse(e.EquipmentID)
		if err != nil {
			continue
		}
		create.EquipmentReqs = append(create.EquipmentReqs, ServiceCreateReqItem{EquipmentID: id, QuantityNeeded: e.QuantityNeeded})
	}
	for _, s := range req.StaffReqs {
		id, err := uuid.Parse(s.StaffRoleID)
		if err != nil {
			continue
		}
		create.StaffReqs = append(create.StaffReqs, ServiceCreateReqItem{StaffRoleID: id, QuantityNeeded: s.QuantityNeeded})
	}
	svc, err := h.service.CreateService(c.Request.Context(), userID, create)
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, toServiceResp(svc))
}

func (h *CatalogItemHandler) DeleteService(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	id, ok := h.pathID(c, "id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "ServiceItem ID must be a valid UUID")
		return
	}
	if err := h.service.DeleteService(c.Request.Context(), userID, id); err != nil {
		h.catalogErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Location pivot handlers ──────────────────────────────────────────────────

func (h *CatalogItemHandler) locationID(c *gin.Context) (uuid.UUID, bool) {
	return h.pathID(c, "id")
}

func (h *CatalogItemHandler) ListLocationEquipment(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.locationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	items, err := h.service.ListLocationEquipment(c.Request.Context(), userID, locationID)
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	resp := make([]gin.H, len(items))
	for i, le := range items {
		resp[i] = gin.H{"id": le.ID, "location_id": le.LocationID, "equipment_id": le.EquipmentID, "equipment_name": le.EquipmentName, "quantity": le.Quantity}
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *CatalogItemHandler) AddLocationEquipment(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.locationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	var req struct {
		EquipmentID string `json:"equipment_id" binding:"required,uuid"`
		Quantity    int    `json:"quantity"     binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	eqID, _ := uuid.Parse(req.EquipmentID) //nolint:errcheck // binding:"uuid" already validated
	le, err := h.service.AddLocationEquipment(c.Request.Context(), userID, locationID, LocationEquipmentCreate{EquipmentID: eqID, Quantity: req.Quantity})
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": le.ID, "location_id": le.LocationID, "equipment_id": le.EquipmentID, "equipment_name": le.EquipmentName, "quantity": le.Quantity})
}

func (h *CatalogItemHandler) RemoveLocationEquipment(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.locationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	itemID, ok := h.pathID(c, "item_id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Item ID must be a valid UUID")
		return
	}
	if err := h.service.RemoveLocationEquipment(c.Request.Context(), userID, locationID, itemID); err != nil {
		h.catalogErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *CatalogItemHandler) ListLocationStaffRoles(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.locationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	items, err := h.service.ListLocationStaffRoles(c.Request.Context(), userID, locationID)
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	resp := make([]gin.H, len(items))
	for i, ls := range items {
		resp[i] = gin.H{"id": ls.ID, "location_id": ls.LocationID, "staff_role_id": ls.StaffRoleID, "job_title": ls.JobTitle, "quantity": ls.Quantity}
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *CatalogItemHandler) AddLocationStaffRole(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.locationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	var req struct {
		StaffRoleID string `json:"staff_role_id" binding:"required,uuid"`
		Quantity    int    `json:"quantity"      binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	srID, _ := uuid.Parse(req.StaffRoleID) //nolint:errcheck // binding:"uuid" already validated
	ls, err := h.service.AddLocationStaffRole(c.Request.Context(), userID, locationID, LocationStaffRoleCreate{StaffRoleID: srID, Quantity: req.Quantity})
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": ls.ID, "location_id": ls.LocationID, "staff_role_id": ls.StaffRoleID, "job_title": ls.JobTitle, "quantity": ls.Quantity})
}

func (h *CatalogItemHandler) RemoveLocationStaffRole(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.locationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	itemID, ok := h.pathID(c, "item_id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Item ID must be a valid UUID")
		return
	}
	if err := h.service.RemoveLocationStaffRole(c.Request.Context(), userID, locationID, itemID); err != nil {
		h.catalogErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *CatalogItemHandler) ListLocationServices(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.locationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	items, err := h.service.ListLocationServices(c.Request.Context(), userID, locationID)
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	resp := make([]gin.H, len(items))
	for i, ls := range items {
		resp[i] = gin.H{"id": ls.ID, "location_id": ls.LocationID, "service_id": ls.ServiceID, "is_active": ls.IsActive, "service": toServiceResp(ls.ServiceItem)}
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *CatalogItemHandler) AddLocationService(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.locationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	var req struct {
		ServiceID string `json:"service_id" binding:"required,uuid"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	svcID, _ := uuid.Parse(req.ServiceID) //nolint:errcheck // binding:"uuid" already validated
	ls, err := h.service.AddLocationService(c.Request.Context(), userID, locationID, LocationServiceItemCreate{ServiceID: svcID})
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": ls.ID, "location_id": ls.LocationID, "service_id": ls.ServiceID, "is_active": ls.IsActive, "service": toServiceResp(ls.ServiceItem)})
}

func (h *CatalogItemHandler) RemoveLocationService(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.locationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	itemID, ok := h.pathID(c, "item_id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Item ID must be a valid UUID")
		return
	}
	if err := h.service.RemoveLocationService(c.Request.Context(), userID, locationID, itemID); err != nil {
		h.catalogErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
