package booking

import (
	"context"
	"net/http"
	"testing"
	"time"

	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testProviderID int64 = 99

func newAdminTestRouter(repo bookingRepository) *gin.Engine {
	svc := NewService(repo, nil, nil)
	h := NewHandler(svc)
	r := gin.New()

	providerAuth := func(c *gin.Context) {
		c.Set(contextKeyUserID, testProviderID)
		c.Next()
	}

	r.GET("/api/v1/bookings/provider", providerAuth, h.ListProviderBookings)
	r.PATCH("/api/v1/bookings/:id/status", providerAuth, h.UpdateBookingStatus)
	return r
}

func buildProviderBookingRow() *BookingRow {
	return &BookingRow{
		ID:            1,
		UUID:          uuid.New(),
		LocationID:    1,
		LocationUUID:  uuid.New(),
		ConsumerID:    2,
		ConsumerUUID:  uuid.New(),
		ConsumerName:  "Test Customer",
		ConsumerEmail: "customer@test.com",
		Status:        "confirmed",
		TotalAmount:   50.00,
		Currency:      "EUR",
		CreatedAt:     time.Now(),
		Items: []BookingItemRow{{
			ID:              1,
			UUID:            uuid.New(),
			ServiceID:       1,
			ServiceUUID:     uuid.New(),
			ServiceName:     "Personal Workout",
			StartAt:         time.Now().Add(24 * time.Hour),
			EndAt:           time.Now().Add(25 * time.Hour),
			DurationMinutes: 60,
			Price:           50.00,
			Status:          "confirmed",
		}},
	}
}

// ─── ListProviderBookings ─────────────────────────────────────────────────────

func TestListProviderBookings(t *testing.T) {
	t.Parallel()

	t.Run("200 returns empty list", func(t *testing.T) {
		t.Parallel()
		repo := &mockRepo{
			listByProvider: func(_ context.Context, _ int64, _ *string, _ *string, _ *string, _ *string, _, _ int) ([]BookingRow, int, error) {
				return []BookingRow{}, 0, nil
			},
		}
		rr := doReq(newAdminTestRouter(repo), http.MethodGet, "/api/v1/bookings/provider", nil)
		assert.Equal(t, http.StatusOK, rr.Code)
		var body map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.NotNil(t, body["data"])
		assert.NotNil(t, body["pagination"])
	})

	t.Run("200 returns bookings with consumer info", func(t *testing.T) {
		t.Parallel()
		booking := buildProviderBookingRow()
		repo := &mockRepo{
			listByProvider: func(_ context.Context, _ int64, _ *string, _ *string, _ *string, _ *string, _, _ int) ([]BookingRow, int, error) {
				return []BookingRow{*booking}, 1, nil
			},
		}
		rr := doReq(newAdminTestRouter(repo), http.MethodGet, "/api/v1/bookings/provider", nil)
		assert.Equal(t, http.StatusOK, rr.Code)
		var body map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		data := body["data"].([]any)
		assert.Len(t, data, 1)
		first := data[0].(map[string]any)
		assert.Equal(t, "Test Customer", first["consumer_name"])
	})

	t.Run("forwards status filter to repository", func(t *testing.T) {
		t.Parallel()
		var capturedStatus *string
		repo := &mockRepo{
			listByProvider: func(_ context.Context, _ int64, _ *string, status *string, _, _ *string, _, _ int) ([]BookingRow, int, error) {
				capturedStatus = status
				return []BookingRow{}, 0, nil
			},
		}
		doReq(newAdminTestRouter(repo), http.MethodGet, "/api/v1/bookings/provider?status=confirmed", nil)
		require.NotNil(t, capturedStatus)
		assert.Equal(t, "confirmed", *capturedStatus)
	})
}

// ─── UpdateBookingStatus ──────────────────────────────────────────────────────

func TestUpdateBookingStatus(t *testing.T) {
	t.Parallel()

	t.Run("400 on invalid UUID", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newAdminTestRouter(&mockRepo{}), http.MethodPatch,
			"/api/v1/bookings/not-a-uuid/status",
			map[string]any{"status": "completed"})
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("400 on missing status field", func(t *testing.T) {
		t.Parallel()
		rr := doReq(newAdminTestRouter(&mockRepo{}), http.MethodPatch,
			"/api/v1/bookings/"+uuid.New().String()+"/status",
			map[string]any{})
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("404 when booking not found", func(t *testing.T) {
		t.Parallel()
		repo := &mockRepo{
			updateStatus: func(_ context.Context, _ uuid.UUID, _ int64, _ string, _ *string) (*BookingRow, error) {
				return nil, ErrBookingNotFound
			},
		}
		rr := doReq(newAdminTestRouter(repo), http.MethodPatch,
			"/api/v1/bookings/"+uuid.New().String()+"/status",
			map[string]any{"status": "completed"})
		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("409 on invalid transition", func(t *testing.T) {
		t.Parallel()
		repo := &mockRepo{
			updateStatus: func(_ context.Context, _ uuid.UUID, _ int64, _ string, _ *string) (*BookingRow, error) {
				return nil, ErrInvalidTransition
			},
		}
		rr := doReq(newAdminTestRouter(repo), http.MethodPatch,
			"/api/v1/bookings/"+uuid.New().String()+"/status",
			map[string]any{"status": "completed"})
		assert.Equal(t, http.StatusConflict, rr.Code)
	})

	t.Run("200 on valid transition", func(t *testing.T) {
		t.Parallel()
		booking := buildProviderBookingRow()
		booking.Status = "completed"
		repo := &mockRepo{
			updateStatus: func(_ context.Context, _ uuid.UUID, _ int64, _ string, _ *string) (*BookingRow, error) {
				return booking, nil
			},
		}
		rr := doReq(newAdminTestRouter(repo), http.MethodPatch,
			"/api/v1/bookings/"+uuid.New().String()+"/status",
			map[string]any{"status": "completed"})
		assert.Equal(t, http.StatusOK, rr.Code)
		var body map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
		assert.Equal(t, "completed", body["status"])
	})
}
