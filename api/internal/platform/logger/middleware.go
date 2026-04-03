package logger

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Middleware returns a Gin middleware that logs requests with structured data.
func Middleware(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Generate request ID
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)

		// Process request
		c.Next()

		// Log after request completes
		latency := time.Since(start)
		status := c.Writer.Status()

		attrs := []any{
			KeyRequestID, requestID,
			KeyMethod, c.Request.Method,
			KeyPath, c.Request.URL.Path,
			KeyStatus, status,
			KeyLatency, latency.Milliseconds(),
			"client_ip", c.ClientIP(),
		}

		// Add user ID if present
		if userID, exists := c.Get("user_id"); exists {
			attrs = append(attrs, KeyUserID, userID)
		}

		// Log level based on status
		msg := "request"
		switch {
		case status >= 500:
			logger.Error(msg, attrs...)
		case status >= 400:
			logger.Warn(msg, attrs...)
		default:
			logger.Info(msg, attrs...)
		}
	}
}
