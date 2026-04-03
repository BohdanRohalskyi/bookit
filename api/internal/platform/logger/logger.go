package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
)

// Keys for structured logging
const (
	KeyRequestID = "request_id"
	KeyUserID    = "user_id"
	KeyMethod    = "method"
	KeyPath      = "path"
	KeyStatus    = "status"
	KeyLatency   = "latency_ms"
	KeyError     = "error"
)

// New creates a logger configured for the environment.
// Production uses JSON (Cloud Logging compatible), development uses text.
func New(environment string) *slog.Logger {
	var handler slog.Handler

	opts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}

	if environment == "production" || environment == "prod" || environment == "staging" {
		// JSON format for Cloud Logging
		// Cloud Logging automatically parses JSON and extracts severity
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		// Text format for local development
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	return slog.New(handler)
}

// NewWithWriter creates a logger with a custom writer (useful for testing).
func NewWithWriter(w io.Writer, json bool) *slog.Logger {
	opts := &slog.HandlerOptions{Level: slog.LevelInfo}

	if json {
		return slog.New(slog.NewJSONHandler(w, opts))
	}
	return slog.New(slog.NewTextHandler(w, opts))
}

// WithRequestID adds request ID to logger context.
func WithRequestID(logger *slog.Logger, requestID string) *slog.Logger {
	return logger.With(KeyRequestID, requestID)
}

// WithUserID adds user ID to logger context.
func WithUserID(logger *slog.Logger, userID string) *slog.Logger {
	return logger.With(KeyUserID, userID)
}

// Error logs an error with the error message.
func Error(ctx context.Context, logger *slog.Logger, msg string, err error, attrs ...any) {
	args := append([]any{KeyError, err.Error()}, attrs...)
	logger.ErrorContext(ctx, msg, args...)
}
