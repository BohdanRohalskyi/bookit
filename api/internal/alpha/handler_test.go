package alpha

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func init() { gin.SetMode(gin.TestMode) }

type mockSubmitter struct {
	submit func(ctx context.Context, req AccessRequestCreate) error
}

func (m *mockSubmitter) Submit(ctx context.Context, req AccessRequestCreate) error {
	if m.submit != nil {
		return m.submit(ctx, req)
	}
	return nil
}

func newTestRouter(svc submitter) *gin.Engine {
	h := NewHandler(svc)
	r := gin.New()
	r.POST("/api/v1/alpha-access", h.Submit)
	return r
}

func do(r *gin.Engine, body any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/api/v1/alpha-access", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func TestSubmitHandler(t *testing.T) {
	t.Parallel()

	validBody := map[string]string{
		"email":        "test@example.com",
		"company_name": "Acme Corp",
		"description":  "We want early access",
	}

	t.Run("201 on valid request", func(t *testing.T) {
		t.Parallel()
		rr := do(newTestRouter(&mockSubmitter{}), validBody)
		assert.Equal(t, http.StatusCreated, rr.Code)

		var resp map[string]string
		_ = json.Unmarshal(rr.Body.Bytes(), &resp)
		assert.NotEmpty(t, resp["message"])
	})

	t.Run("400 missing email", func(t *testing.T) {
		t.Parallel()
		body := map[string]string{"company_name": "Acme", "description": "desc"}
		rr := do(newTestRouter(&mockSubmitter{}), body)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("400 missing company_name", func(t *testing.T) {
		t.Parallel()
		body := map[string]string{"email": "test@example.com", "description": "desc"}
		rr := do(newTestRouter(&mockSubmitter{}), body)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("400 missing description", func(t *testing.T) {
		t.Parallel()
		body := map[string]string{"email": "test@example.com", "company_name": "Acme"}
		rr := do(newTestRouter(&mockSubmitter{}), body)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("400 invalid email format", func(t *testing.T) {
		t.Parallel()
		body := map[string]string{"email": "not-an-email", "company_name": "Acme", "description": "desc"}
		rr := do(newTestRouter(&mockSubmitter{}), body)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("500 on service error", func(t *testing.T) {
		t.Parallel()
		svc := &mockSubmitter{
			submit: func(_ context.Context, _ AccessRequestCreate) error {
				return errors.New("db down")
			},
		}
		rr := do(newTestRouter(svc), validBody)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})
}
