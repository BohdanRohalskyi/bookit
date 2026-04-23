package catalog

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

func init() {
	gin.SetMode(gin.TestMode)
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

type mockSearcher struct {
	searchServices   func(ctx context.Context, p ServiceSearchParams) ([]ServiceSearchResultItem, int, error)
	getServiceDetail func(ctx context.Context, id uuid.UUID) (ServiceDetail, error)
}

func (m *mockSearcher) SearchServices(ctx context.Context, p ServiceSearchParams) ([]ServiceSearchResultItem, int, error) {
	if m.searchServices != nil {
		return m.searchServices(ctx, p)
	}
	return []ServiceSearchResultItem{}, 0, nil
}

func (m *mockSearcher) GetServiceDetail(ctx context.Context, id uuid.UUID) (ServiceDetail, error) {
	if m.getServiceDetail != nil {
		return m.getServiceDetail(ctx, id)
	}
	return ServiceDetail{}, ErrServiceNotFound
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func newSearchRouter(searcher catalogSearcher) *gin.Engine {
	h := &CatalogItemHandler{searcher: searcher}
	r := gin.New()
	r.GET("/api/v1/services/search", h.SearchServices)
	r.GET("/api/v1/services/:id", h.GetServicePublic)
	return r
}

func doReq(r *gin.Engine, method, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequestWithContext(context.Background(), method, path, bytes.NewReader(nil))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func decodeBody(t *testing.T, rr *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
	return body
}

func buildServiceItem() ServiceSearchResultItem {
	return ServiceSearchResultItem{
		UUID:            uuid.New(),
		Name:            "Haircut",
		DurationMinutes: 60,
		Price:           25.00,
		Currency:        "EUR",
		BusinessUUID:    uuid.New(),
		BusinessName:    "Top Cuts",
		Category:        "beauty",
	}
}

func buildServiceDetail() ServiceDetail {
	return ServiceDetail{
		UUID:            uuid.New(),
		Name:            "Haircut",
		DurationMinutes: 60,
		Price:           25.00,
		Currency:        "EUR",
		BusinessUUID:    uuid.New(),
		BusinessName:    "Top Cuts",
		Category:        "beauty",
		CreatedAt:       time.Now(),
	}
}

// ─── SearchServices ───────────────────────────────────────────────────────────

func TestSearchServices(t *testing.T) {
	t.Parallel()

	t.Run("200 with empty result when no services", func(t *testing.T) {
		t.Parallel()
		r := newSearchRouter(&mockSearcher{})
		rr := doReq(r, http.MethodGet, "/api/v1/services/search")
		assert.Equal(t, http.StatusOK, rr.Code)
		body := decodeBody(t, rr)
		data, ok := body["data"].([]any)
		require.True(t, ok)
		assert.Len(t, data, 0)
	})

	t.Run("200 returns service list from searcher", func(t *testing.T) {
		t.Parallel()
		items := []ServiceSearchResultItem{buildServiceItem(), buildServiceItem()}
		r := newSearchRouter(&mockSearcher{
			searchServices: func(_ context.Context, _ ServiceSearchParams) ([]ServiceSearchResultItem, int, error) {
				return items, 2, nil
			},
		})
		rr := doReq(r, http.MethodGet, "/api/v1/services/search")
		assert.Equal(t, http.StatusOK, rr.Code)
		body := decodeBody(t, rr)
		data, ok := body["data"].([]any)
		require.True(t, ok)
		assert.Len(t, data, 2)
	})

	t.Run("400 on invalid category value", func(t *testing.T) {
		t.Parallel()
		r := newSearchRouter(&mockSearcher{})
		rr := doReq(r, http.MethodGet, "/api/v1/services/search?category=invalid")
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("passes q filter to searcher", func(t *testing.T) {
		t.Parallel()
		var captured ServiceSearchParams
		r := newSearchRouter(&mockSearcher{
			searchServices: func(_ context.Context, p ServiceSearchParams) ([]ServiceSearchResultItem, int, error) {
				captured = p
				return []ServiceSearchResultItem{}, 0, nil
			},
		})
		doReq(r, http.MethodGet, "/api/v1/services/search?q=yoga")
		require.NotNil(t, captured.Q)
		assert.Equal(t, "yoga", *captured.Q)
	})

	t.Run("passes category filter to searcher", func(t *testing.T) {
		t.Parallel()
		var captured ServiceSearchParams
		r := newSearchRouter(&mockSearcher{
			searchServices: func(_ context.Context, p ServiceSearchParams) ([]ServiceSearchResultItem, int, error) {
				captured = p
				return []ServiceSearchResultItem{}, 0, nil
			},
		})
		doReq(r, http.MethodGet, "/api/v1/services/search?category=sport")
		require.NotNil(t, captured.Category)
		assert.Equal(t, "sport", *captured.Category)
	})

	t.Run("passes city filter to searcher", func(t *testing.T) {
		t.Parallel()
		var captured ServiceSearchParams
		r := newSearchRouter(&mockSearcher{
			searchServices: func(_ context.Context, p ServiceSearchParams) ([]ServiceSearchResultItem, int, error) {
				captured = p
				return []ServiceSearchResultItem{}, 0, nil
			},
		})
		doReq(r, http.MethodGet, "/api/v1/services/search?city=Vilnius")
		require.NotNil(t, captured.City)
		assert.Equal(t, "Vilnius", *captured.City)
	})

	t.Run("pagination defaults to page 1, per_page 20", func(t *testing.T) {
		t.Parallel()
		var captured ServiceSearchParams
		r := newSearchRouter(&mockSearcher{
			searchServices: func(_ context.Context, p ServiceSearchParams) ([]ServiceSearchResultItem, int, error) {
				captured = p
				return []ServiceSearchResultItem{}, 0, nil
			},
		})
		doReq(r, http.MethodGet, "/api/v1/services/search")
		assert.Equal(t, 1, captured.Page)
		assert.Equal(t, 20, captured.PerPage)
	})

	t.Run("pagination params forwarded to searcher", func(t *testing.T) {
		t.Parallel()
		var captured ServiceSearchParams
		r := newSearchRouter(&mockSearcher{
			searchServices: func(_ context.Context, p ServiceSearchParams) ([]ServiceSearchResultItem, int, error) {
				captured = p
				return []ServiceSearchResultItem{}, 0, nil
			},
		})
		doReq(r, http.MethodGet, "/api/v1/services/search?page=3&per_page=10")
		assert.Equal(t, 3, captured.Page)
		assert.Equal(t, 10, captured.PerPage)
	})

	t.Run("pagination response includes total_pages", func(t *testing.T) {
		t.Parallel()
		r := newSearchRouter(&mockSearcher{
			searchServices: func(_ context.Context, _ ServiceSearchParams) ([]ServiceSearchResultItem, int, error) {
				return make([]ServiceSearchResultItem, 5), 45, nil
			},
		})
		rr := doReq(r, http.MethodGet, "/api/v1/services/search?per_page=20")
		assert.Equal(t, http.StatusOK, rr.Code)
		body := decodeBody(t, rr)
		pagination, ok := body["pagination"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, float64(3), pagination["total_pages"])
		assert.Equal(t, float64(45), pagination["total"])
	})
}

// ─── GetServicePublic ─────────────────────────────────────────────────────────

func TestGetServicePublic(t *testing.T) {
	t.Parallel()

	t.Run("400 on non-UUID path param", func(t *testing.T) {
		t.Parallel()
		r := newSearchRouter(&mockSearcher{})
		rr := doReq(r, http.MethodGet, "/api/v1/services/not-a-uuid")
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("404 when service not found", func(t *testing.T) {
		t.Parallel()
		r := newSearchRouter(&mockSearcher{})
		rr := doReq(r, http.MethodGet, fmt.Sprintf("/api/v1/services/%s", uuid.New()))
		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("200 returns service detail fields", func(t *testing.T) {
		t.Parallel()
		detail := buildServiceDetail()
		r := newSearchRouter(&mockSearcher{
			getServiceDetail: func(_ context.Context, _ uuid.UUID) (ServiceDetail, error) {
				return detail, nil
			},
		})
		rr := doReq(r, http.MethodGet, fmt.Sprintf("/api/v1/services/%s", uuid.New()))
		assert.Equal(t, http.StatusOK, rr.Code)
		body := decodeBody(t, rr)
		assert.Equal(t, detail.Name, body["name"])
		assert.Equal(t, detail.BusinessName, body["business_name"])
		assert.Equal(t, detail.Category, body["category"])
		assert.Equal(t, detail.Price, body["price"])
	})
}
