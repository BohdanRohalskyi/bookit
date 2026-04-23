package booking

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() { gin.SetMode(gin.TestMode) }

// ─── Mock ─────────────────────────────────────────────────────────────────────

type mockRepo struct {
	getServiceSchedule func(ctx context.Context, serviceUUID uuid.UUID, date time.Time) (*ServiceScheduleInfo, error)
	getBookedTimes     func(ctx context.Context, serviceID int64, date time.Time) ([]string, error)
	create             func(ctx context.Context, req CreateBookingReq) (*BookingRow, error)
	getByUUID          func(ctx context.Context, bookingUUID uuid.UUID, consumerID int64) (*BookingRow, error)
	listByConsumer     func(ctx context.Context, consumerID int64, status *string, page, perPage int) ([]BookingRow, int, error)
	listByProvider     func(ctx context.Context, providerUserID int64, locationUUID *string, status *string, fromDate *string, toDate *string, page, perPage int) ([]BookingRow, int, error)
	updateStatus       func(ctx context.Context, bookingUUID uuid.UUID, providerUserID int64, toStatus string, reason *string) (*BookingRow, error)
}

func (m *mockRepo) GetServiceSchedule(ctx context.Context, serviceUUID uuid.UUID, date time.Time) (*ServiceScheduleInfo, error) {
	if m.getServiceSchedule != nil {
		return m.getServiceSchedule(ctx, serviceUUID, date)
	}
	return nil, ErrServiceNotFound
}
func (m *mockRepo) GetBookedStartTimes(ctx context.Context, serviceID int64, date time.Time) ([]string, error) {
	if m.getBookedTimes != nil {
		return m.getBookedTimes(ctx, serviceID, date)
	}
	return nil, nil
}
func (m *mockRepo) Create(ctx context.Context, req CreateBookingReq) (*BookingRow, error) {
	if m.create != nil {
		return m.create(ctx, req)
	}
	return nil, ErrSlotTaken
}
func (m *mockRepo) GetByUUID(ctx context.Context, bookingUUID uuid.UUID, consumerID int64) (*BookingRow, error) {
	if m.getByUUID != nil {
		return m.getByUUID(ctx, bookingUUID, consumerID)
	}
	return nil, ErrBookingNotFound
}
func (m *mockRepo) ListByConsumer(ctx context.Context, consumerID int64, status *string, page, perPage int) ([]BookingRow, int, error) {
	if m.listByConsumer != nil {
		return m.listByConsumer(ctx, consumerID, status, page, perPage)
	}
	return []BookingRow{}, 0, nil
}
func (m *mockRepo) ListByProvider(ctx context.Context, providerUserID int64, locationUUID *string, status *string, fromDate *string, toDate *string, page, perPage int) ([]BookingRow, int, error) {
	if m.listByProvider != nil {
		return m.listByProvider(ctx, providerUserID, locationUUID, status, fromDate, toDate, page, perPage)
	}
	return []BookingRow{}, 0, nil
}
func (m *mockRepo) UpdateStatus(ctx context.Context, bookingUUID uuid.UUID, providerUserID int64, toStatus string, reason *string) (*BookingRow, error) {
	if m.updateStatus != nil {
		return m.updateStatus(ctx, bookingUUID, providerUserID, toStatus, reason)
	}
	return nil, ErrBookingNotFound
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const testConsumerID int64 = 42

func newTestRouter(repo bookingRepository) *gin.Engine {
	svc := NewService(repo, nil, nil)
	h := NewHandler(svc)
	r := gin.New()

	// Inject user ID for protected routes
	auth := func(c *gin.Context) {
		c.Set(contextKeyUserID, testConsumerID)
		c.Next()
	}

	r.GET("/api/v1/availability/slots", h.GetAvailableSlots)
	r.POST("/api/v1/bookings", auth, h.CreateBooking)
	r.GET("/api/v1/bookings", auth, h.ListMyBookings)
	r.GET("/api/v1/bookings/:id", auth, h.GetBooking)
	return r
}

func doReq(r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	var b []byte
	if body != nil {
		b, _ = json.Marshal(body)
	}
	req := httptest.NewRequestWithContext(context.Background(), method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func buildScheduleInfo() *ServiceScheduleInfo {
	return &ServiceScheduleInfo{
		ServiceID:       1,
		ServiceUUID:     uuid.New(),
		DurationMinutes: 60,
		LocationID:      1,
		LocationUUID:    uuid.New(),
		IsOpen:          true,
		OpenTime:        strPtr("09:00"),
		CloseTime:       strPtr("17:00"),
	}
}

func buildBookingRow() *BookingRow {
	return &BookingRow{
		ID:           1,
		UUID:         uuid.New(),
		LocationID:   1,
		LocationUUID: uuid.New(),
		ConsumerID:   testConsumerID,
		ConsumerUUID: uuid.New(),
		Status:       "confirmed",
		TotalAmount:  25.00,
		Currency:     "EUR",
		CreatedAt:    time.Now(),
		Items: []BookingItemRow{{
			ID:              1,
			UUID:            uuid.New(),
			ServiceID:       1,
			ServiceUUID:     uuid.New(),
			ServiceName:     "Haircut",
			StartAt:         time.Now().Add(24 * time.Hour),
			EndAt:           time.Now().Add(25 * time.Hour),
			DurationMinutes: 60,
			Price:           25.00,
			Status:          "confirmed",
		}},
	}
}

func strPtr(s string) *string { return &s }

// ─── GetAvailableSlots ────────────────────────────────────────────────────────

func TestGetAvailableSlots(t *testing.T) {
	t.Parallel()

	t.Run("400 when service_id missing", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newTestRouter(&mockRepo{}), http.MethodGet, "/api/v1/availability/slots?date=2026-05-15", nil)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("400 when date missing", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newTestRouter(&mockRepo{}), http.MethodGet,
			fmt.Sprintf("/api/v1/availability/slots?service_id=%s", uuid.New()), nil)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("400 on invalid date format", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newTestRouter(&mockRepo{}), http.MethodGet,
			fmt.Sprintf("/api/v1/availability/slots?service_id=%s&date=not-a-date", uuid.New()), nil)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("404 when service not found", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newTestRouter(&mockRepo{}), http.MethodGet,
			fmt.Sprintf("/api/v1/availability/slots?service_id=%s&date=2026-05-15", uuid.New()), nil)
		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("200 returns slots for open day", func(t *testing.T) {
		t.Parallel()
		repo := &mockRepo{
			getServiceSchedule: func(_ context.Context, _ uuid.UUID, _ time.Time) (*ServiceScheduleInfo, error) {
				return buildScheduleInfo(), nil
			},
		}
		rr := doReq(newTestRouter(repo), http.MethodGet,
			fmt.Sprintf("/api/v1/availability/slots?service_id=%s&date=2026-05-15", uuid.New()), nil)
		assert.Equal(t, http.StatusOK, rr.Code)
		var body map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		slots := body["slots"].([]any)
		assert.NotEmpty(t, slots)
	})

	t.Run("200 returns empty slots for closed day", func(t *testing.T) {
		t.Parallel()
		info := buildScheduleInfo()
		info.IsOpen = false
		repo := &mockRepo{
			getServiceSchedule: func(_ context.Context, _ uuid.UUID, _ time.Time) (*ServiceScheduleInfo, error) {
				return info, nil
			},
		}
		rr := doReq(newTestRouter(repo), http.MethodGet,
			fmt.Sprintf("/api/v1/availability/slots?service_id=%s&date=2026-05-15", uuid.New()), nil)
		assert.Equal(t, http.StatusOK, rr.Code)
		var body map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		slots := body["slots"].([]any)
		assert.Empty(t, slots)
	})
}

// ─── CreateBooking ────────────────────────────────────────────────────────────

func TestCreateBooking(t *testing.T) {
	t.Parallel()

	validBody := map[string]any{
		"location_id": uuid.New().String(),
		"items": []map[string]any{{
			"service_id":     uuid.New().String(),
			"start_datetime": time.Now().Add(24 * time.Hour).Format(time.RFC3339),
		}},
	}

	t.Run("400 on missing location_id", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newTestRouter(&mockRepo{}), http.MethodPost, "/api/v1/bookings",
			map[string]any{"items": []map[string]any{{"service_id": uuid.New().String(), "start_datetime": time.Now().Add(24 * time.Hour).Format(time.RFC3339)}}})
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("400 on empty items", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newTestRouter(&mockRepo{}), http.MethodPost, "/api/v1/bookings",
			map[string]any{"location_id": uuid.New().String(), "items": []any{}})
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("409 when slot is already taken", func(t *testing.T) {
		t.Parallel()
		repo := &mockRepo{
			getServiceSchedule: func(_ context.Context, _ uuid.UUID, _ time.Time) (*ServiceScheduleInfo, error) {
				return buildScheduleInfo(), nil
			},
			create: func(_ context.Context, _ CreateBookingReq) (*BookingRow, error) {
				return nil, ErrSlotTaken
			},
		}
		rr := doReq(newTestRouter(repo), http.MethodPost, "/api/v1/bookings", validBody)
		assert.Equal(t, http.StatusConflict, rr.Code)
	})

	t.Run("201 on successful booking", func(t *testing.T) {
		t.Parallel()
		repo := &mockRepo{
			getServiceSchedule: func(_ context.Context, _ uuid.UUID, _ time.Time) (*ServiceScheduleInfo, error) {
				return buildScheduleInfo(), nil
			},
			create: func(_ context.Context, _ CreateBookingReq) (*BookingRow, error) {
				return buildBookingRow(), nil
			},
		}
		rr := doReq(newTestRouter(repo), http.MethodPost, "/api/v1/bookings", validBody)
		assert.Equal(t, http.StatusCreated, rr.Code)
		var body map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.NotEmpty(t, body["id"])
		assert.Equal(t, "confirmed", body["status"])
	})
}

// ─── GetBooking ───────────────────────────────────────────────────────────────

func TestGetBooking(t *testing.T) {
	t.Parallel()

	t.Run("400 on non-UUID id", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newTestRouter(&mockRepo{}), http.MethodGet, "/api/v1/bookings/not-a-uuid", nil)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("404 when booking not found", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newTestRouter(&mockRepo{}), http.MethodGet,
			fmt.Sprintf("/api/v1/bookings/%s", uuid.New()), nil)
		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("200 returns booking", func(t *testing.T) {
		t.Parallel()
		booking := buildBookingRow()
		repo := &mockRepo{
			getByUUID: func(_ context.Context, _ uuid.UUID, _ int64) (*BookingRow, error) {
				return booking, nil
			},
		}
		rr := doReq(newTestRouter(repo), http.MethodGet,
			fmt.Sprintf("/api/v1/bookings/%s", uuid.New()), nil)
		assert.Equal(t, http.StatusOK, rr.Code)
	})
}

// ─── ListMyBookings ───────────────────────────────────────────────────────────

func TestListMyBookings(t *testing.T) {
	t.Parallel()

	t.Run("200 returns empty list", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newTestRouter(&mockRepo{}), http.MethodGet, "/api/v1/bookings", nil)
		assert.Equal(t, http.StatusOK, rr.Code)
		var body map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.NotNil(t, body["data"])
	})

	t.Run("200 returns consumer bookings", func(t *testing.T) {
		t.Parallel()
		repo := &mockRepo{
			listByConsumer: func(_ context.Context, _ int64, _ *string, _, _ int) ([]BookingRow, int, error) {
				return []BookingRow{*buildBookingRow()}, 1, nil
			},
		}
		rr := doReq(newTestRouter(repo), http.MethodGet, "/api/v1/bookings", nil)
		assert.Equal(t, http.StatusOK, rr.Code)
		var body map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		data := body["data"].([]any)
		assert.Len(t, data, 1)
	})
}
