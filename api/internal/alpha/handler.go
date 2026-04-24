package alpha

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type submitter interface {
	Submit(ctx context.Context, req AccessRequestCreate) error
}

type Handler struct {
	svc submitter
}

func NewHandler(svc submitter) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Submit(c *gin.Context) {
	var req struct {
		Email       string `json:"email"        binding:"required,email"`
		CompanyName string `json:"company_name" binding:"required,min=1,max=200"`
		Description string `json:"description"  binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"type":   "https://bookit.app/errors/validation-error",
			"title":  "Validation Error",
			"status": http.StatusBadRequest,
			"detail": err.Error(),
		})
		return
	}

	create := AccessRequestCreate{
		Email:       strings.ToLower(strings.TrimSpace(req.Email)),
		CompanyName: strings.TrimSpace(req.CompanyName),
		Description: strings.TrimSpace(req.Description),
	}

	if err := h.svc.Submit(c.Request.Context(), create); err != nil {
		slog.Error("alpha access submit", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"type":   "https://bookit.app/errors/internal-error",
			"title":  "Internal Error",
			"status": http.StatusInternalServerError,
			"detail": "An unexpected error occurred. Please try again.",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Request received. We will be in touch."})
}
