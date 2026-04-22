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
	service      *CatalogService
	locationRepo *LocationRepository // needed to resolve location UUID → int64
	bizRepo      *Repository         // needed to resolve business UUID → int64
	catalogRepo  *CatalogRepository  // needed to resolve item UUIDs → int64
}

func NewCatalogItemHandler(service *CatalogService, locationRepo *LocationRepository, bizRepo *Repository, catalogRepo *CatalogRepository) *CatalogItemHandler {
	return &CatalogItemHandler{service: service, locationRepo: locationRepo, bizRepo: bizRepo, catalogRepo: catalogRepo}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (h *CatalogItemHandler) uid(c *gin.Context) (int64, bool) {
	v, ok := c.Get(contextKeyUserID)
	if !ok {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok
}

// pathUUID parses a path param as UUID.
func (h *CatalogItemHandler) pathUUID(c *gin.Context, param string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(param))
	return id, err == nil
}

// queryUUID parses a query param as UUID.
func (h *CatalogItemHandler) queryUUID(c *gin.Context, key string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Query(key))
	return id, err == nil
}

// resolveLocationID resolves location UUID path param to int64.
func (h *CatalogItemHandler) resolveLocationID(c *gin.Context) (int64, bool) {
	locationUUID, ok := h.pathUUID(c, "id")
	if !ok {
		return 0, false
	}
	l, err := h.locationRepo.GetByUUID(c.Request.Context(), locationUUID)
	if err != nil {
		return 0, false
	}
	return l.ID, true
}

// resolveBusinessID resolves business UUID query param to int64.
func (h *CatalogItemHandler) resolveBusinessIDFromQuery(c *gin.Context) (int64, bool) {
	businessUUID, ok := h.queryUUID(c, "business_id")
	if !ok {
		return 0, false
	}
	b, err := h.bizRepo.GetByUUID(c.Request.Context(), businessUUID)
	if err != nil {
		return 0, false
	}
	return b.ID, true
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
		ID:         e.UUID.String(),
		BusinessID: e.UUID.String(), // business UUID would require a separate join
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
	businessID, ok := h.resolveBusinessIDFromQuery(c)
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
	businessUUID, _ := uuid.Parse(req.BusinessID) //nolint:errcheck // binding:"uuid" already validated
	biz, err := h.bizRepo.GetByUUID(c.Request.Context(), businessUUID)
	if err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
		return
	}
	e, err := h.service.CreateEquipment(c.Request.Context(), userID, EquipmentCreate{BusinessID: biz.ID, Name: req.Name})
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
	equipUUID, ok := h.pathUUID(c, "id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Equipment ID must be a valid UUID")
		return
	}
	// Resolve to int64
	var equipID int64
	err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM equipment WHERE uuid = $1`, equipUUID).Scan(&equipID)
	if err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Equipment not found")
		return
	}
	if err := h.service.DeleteEquipment(c.Request.Context(), userID, equipID); err != nil {
		h.catalogErr(c, err)
		return
	}
	if err := h.service.DeleteEquipmentExec(c.Request.Context(), equipID); err != nil {
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
	Role       string `json:"role"`
	IsSystem   bool   `json:"is_system"`
	CreatedAt  string `json:"created_at"`
}

func toStaffRoleResp(s StaffRole) StaffRoleResponse {
	return StaffRoleResponse{
		ID:         s.UUID.String(),
		BusinessID: s.BusinessUUID.String(),
		JobTitle:   s.JobTitle,
		Role:       s.RoleSlug,
		IsSystem:   s.IsSystem,
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
	businessID, ok := h.resolveBusinessIDFromQuery(c)
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
		Role       string `json:"role"        binding:"omitempty,oneof=administrator staff"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", err.Error())
		return
	}
	roleSlug := req.Role
	if roleSlug == "" {
		roleSlug = "staff"
	}
	roleID, err := h.catalogRepo.GetRoleIDBySlug(c.Request.Context(), roleSlug)
	if err != nil {
		errResp(c, http.StatusBadRequest, "validation-error", "Validation Error", "invalid role")
		return
	}
	businessUUID, _ := uuid.Parse(req.BusinessID) //nolint:errcheck
	biz, err := h.bizRepo.GetByUUID(c.Request.Context(), businessUUID)
	if err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
		return
	}
	s, err := h.service.CreateStaffRole(c.Request.Context(), userID, StaffRoleCreate{
		BusinessID: biz.ID,
		JobTitle:   req.JobTitle,
		RoleID:     roleID,
	})
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
	srUUID, ok := h.pathUUID(c, "id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Staff role ID must be a valid UUID")
		return
	}
	var srID int64
	err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM staff_roles WHERE uuid = $1`, srUUID).Scan(&srID)
	if err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Staff role not found")
		return
	}
	if err := h.service.DeleteStaffRole(c.Request.Context(), userID, srID); err != nil {
		if errors.Is(err, ErrStaffRoleProtected) {
			errResp(c, http.StatusUnprocessableEntity, "protected", "Protected Resource", "System job titles cannot be deleted")
			return
		}
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
		eqs[i] = ServiceEquipmentReqResponse{EquipmentID: e.EquipmentUUID.String(), EquipmentName: e.EquipmentName, QuantityNeeded: e.QuantityNeeded}
	}
	srs := make([]ServiceStaffReqResponse, len(s.Staff))
	for i, sr := range s.Staff {
		srs[i] = ServiceStaffReqResponse{StaffRoleID: sr.StaffRoleUUID.String(), JobTitle: sr.JobTitle, QuantityNeeded: sr.QuantityNeeded}
	}
	return ServiceResponse{
		ID: s.UUID.String(), BusinessID: s.UUID.String(), Name: s.Name,
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
	businessID, ok := h.resolveBusinessIDFromQuery(c)
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
	businessUUID, _ := uuid.Parse(req.BusinessID) //nolint:errcheck
	biz, err := h.bizRepo.GetByUUID(c.Request.Context(), businessUUID)
	if err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Business not found")
		return
	}
	cur := req.Currency
	if cur == "" {
		cur = "EUR"
	}
	create := ServiceItemCreate{
		BusinessID:      biz.ID,
		Name:            req.Name,
		Description:     req.Description,
		DurationMinutes: req.DurationMinutes,
		Price:           req.Price,
		Currency:        cur,
	}
	for _, e := range req.EquipmentReqs {
		equipUUID, err := uuid.Parse(e.EquipmentID)
		if err != nil {
			continue
		}
		var equipID int64
		if err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM equipment WHERE uuid = $1`, equipUUID).Scan(&equipID); err != nil {
			continue
		}
		create.EquipmentReqs = append(create.EquipmentReqs, ServiceCreateReqItem{EquipmentID: equipID, QuantityNeeded: e.QuantityNeeded})
	}
	for _, s := range req.StaffReqs {
		srUUID, err := uuid.Parse(s.StaffRoleID)
		if err != nil {
			continue
		}
		var srID int64
		if err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM staff_roles WHERE uuid = $1`, srUUID).Scan(&srID); err != nil {
			continue
		}
		create.StaffReqs = append(create.StaffReqs, ServiceCreateReqItem{StaffRoleID: srID, QuantityNeeded: s.QuantityNeeded})
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
	svcUUID, ok := h.pathUUID(c, "id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "ServiceItem ID must be a valid UUID")
		return
	}
	var svcID int64
	err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM services WHERE uuid = $1`, svcUUID).Scan(&svcID)
	if err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Service not found")
		return
	}
	if err := h.service.DeleteService(c.Request.Context(), userID, svcID); err != nil {
		h.catalogErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Location pivot handlers ──────────────────────────────────────────────────

func (h *CatalogItemHandler) ListLocationEquipment(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.resolveLocationID(c)
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
		resp[i] = gin.H{"id": le.UUID, "location_id": le.UUID, "equipment_id": le.EquipmentUUID, "equipment_name": le.EquipmentName, "quantity": le.Quantity}
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *CatalogItemHandler) AddLocationEquipment(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.resolveLocationID(c)
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
	eqUUID, _ := uuid.Parse(req.EquipmentID) //nolint:errcheck
	var eqID int64
	if err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM equipment WHERE uuid = $1`, eqUUID).Scan(&eqID); err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Equipment not found")
		return
	}
	le, err := h.service.AddLocationEquipment(c.Request.Context(), userID, locationID, LocationEquipmentCreate{EquipmentID: eqID, Quantity: req.Quantity})
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": le.UUID, "location_id": le.UUID, "equipment_id": le.EquipmentUUID, "equipment_name": le.EquipmentName, "quantity": le.Quantity})
}

func (h *CatalogItemHandler) RemoveLocationEquipment(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.resolveLocationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	itemUUID, ok := h.pathUUID(c, "item_id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Item ID must be a valid UUID")
		return
	}
	var itemID int64
	if err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM location_equipment WHERE uuid = $1`, itemUUID).Scan(&itemID); err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Item not found")
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
	locationID, ok := h.resolveLocationID(c)
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
		resp[i] = gin.H{"id": ls.UUID, "location_id": ls.UUID, "staff_role_id": ls.StaffRoleUUID, "job_title": ls.JobTitle, "quantity": ls.Quantity}
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *CatalogItemHandler) AddLocationStaffRole(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.resolveLocationID(c)
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
	srUUID, _ := uuid.Parse(req.StaffRoleID) //nolint:errcheck
	var srID int64
	if err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM staff_roles WHERE uuid = $1`, srUUID).Scan(&srID); err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Staff role not found")
		return
	}
	ls, err := h.service.AddLocationStaffRole(c.Request.Context(), userID, locationID, LocationStaffRoleCreate{StaffRoleID: srID, Quantity: req.Quantity})
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": ls.UUID, "location_id": ls.UUID, "staff_role_id": ls.StaffRoleUUID, "job_title": ls.JobTitle, "quantity": ls.Quantity})
}

func (h *CatalogItemHandler) RemoveLocationStaffRole(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.resolveLocationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	itemUUID, ok := h.pathUUID(c, "item_id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Item ID must be a valid UUID")
		return
	}
	var itemID int64
	if err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM location_staff_roles WHERE uuid = $1`, itemUUID).Scan(&itemID); err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Item not found")
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
	locationID, ok := h.resolveLocationID(c)
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
		resp[i] = gin.H{"id": ls.UUID, "location_id": ls.UUID, "service_id": ls.ServiceItem.UUID, "is_active": ls.IsActive, "service": toServiceResp(ls.ServiceItem)}
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *CatalogItemHandler) AddLocationService(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.resolveLocationID(c)
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
	svcUUID, _ := uuid.Parse(req.ServiceID) //nolint:errcheck
	var svcID int64
	if err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM services WHERE uuid = $1`, svcUUID).Scan(&svcID); err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Service not found")
		return
	}
	ls, err := h.service.AddLocationService(c.Request.Context(), userID, locationID, LocationServiceItemCreate{ServiceID: svcID})
	if err != nil {
		h.catalogErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": ls.UUID, "location_id": ls.UUID, "service_id": ls.ServiceItem.UUID, "is_active": ls.IsActive, "service": toServiceResp(ls.ServiceItem)})
}

func (h *CatalogItemHandler) RemoveLocationService(c *gin.Context) {
	userID, ok := h.uid(c)
	if !ok {
		errResp(c, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Authentication required")
		return
	}
	locationID, ok := h.resolveLocationID(c)
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Location ID must be a valid UUID")
		return
	}
	itemUUID, ok := h.pathUUID(c, "item_id")
	if !ok {
		errResp(c, http.StatusBadRequest, "invalid-id", "Invalid ID", "Item ID must be a valid UUID")
		return
	}
	var itemID int64
	if err := h.catalogRepo.db.QueryRow(c.Request.Context(), `SELECT id FROM location_services WHERE uuid = $1`, itemUUID).Scan(&itemID); err != nil {
		errResp(c, http.StatusNotFound, "not-found", "Not Found", "Item not found")
		return
	}
	if err := h.service.RemoveLocationService(c.Request.Context(), userID, locationID, itemID); err != nil {
		h.catalogErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
