package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/BohdanRohalskyi/bookit/api/internal/platform/config"
	"github.com/BohdanRohalskyi/bookit/api/internal/platform/database"
	"github.com/BohdanRohalskyi/bookit/api/internal/platform/flags"
	"github.com/BohdanRohalskyi/bookit/api/internal/platform/logger"
)

var version = "1.0.1"

func main() {
	if err := run(); err != nil {
		slog.Error("fatal error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	// Initialize structured logger
	log := logger.New(cfg.Environment)
	slog.SetDefault(log)

	// Set Gin mode based on environment
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	// Connect to database
	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer db.Close()

	log.Info("connected to database")

	// Initialize feature flags
	var flagService *flags.Service
	if cfg.GCPProject != "" {
		var err error
		flagService, err = flags.NewService(ctx, cfg.GCPProject, cfg.Environment)
		if err != nil {
			log.Warn("feature flags unavailable", "error", err)
		} else {
			log.Info("feature flags initialized", "staging", cfg.Environment == "staging")
		}
	}

	// Setup router
	router := gin.New()
	router.Use(logger.Middleware(log))
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())

	// Health endpoint
	router.GET("/api/v1/health", healthHandler(db))

	// Feature flags endpoint
	router.GET("/api/v1/flags", flagsHandler(flagService))

	// Feature test endpoint - demonstrates server-side flag usage
	router.GET("/api/v1/feature-test", featureTestHandler(flagService))

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.APIPort),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info("starting server", "port", cfg.APIPort, "environment", cfg.Environment, "version", version)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("shutting down server")

	// Graceful shutdown with 30s timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("server shutdown: %w", err)
	}

	log.Info("server stopped")
	return nil
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Allow localhost for development and Firebase hosting for production
		allowedOrigins := []string{
			"http://localhost:5173",
			"http://localhost:3000",
		}

		// Also allow any Firebase hosting URL
		allowed := false
		for _, o := range allowedOrigins {
			if origin == o {
				allowed = true
				break
			}
		}
		// Allow Firebase hosting domains
		if !allowed && len(origin) > 0 &&
			(strings.HasSuffix(origin, ".web.app") || strings.HasSuffix(origin, ".firebaseapp.com")) {
			allowed = true
		}

		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

type HealthResponse struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Version   string            `json:"version"`
	Checks    map[string]string `json:"checks"`
}

func healthHandler(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		response := HealthResponse{
			Timestamp: time.Now().UTC(),
			Version:   version,
			Checks:    make(map[string]string),
		}

		// Check database
		if err := db.Health(ctx); err != nil {
			response.Status = "unhealthy"
			response.Checks["database"] = "error"
			c.JSON(http.StatusServiceUnavailable, response)
			return
		}

		response.Status = "healthy"
		response.Checks["database"] = "ok"
		c.JSON(http.StatusOK, response)
	}
}

func flagsHandler(flagService *flags.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if flagService == nil {
			c.JSON(http.StatusOK, gin.H{})
			return
		}
		c.JSON(http.StatusOK, flagService.GetAll(c.Request.Context()))
	}
}

func featureTestHandler(flagService *flags.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if flagService == nil {
			c.JSON(http.StatusOK, gin.H{"message": "FEATURE FLAGS UNAVAILABLE"})
			return
		}

		enabled := flagService.IsEnabled(c.Request.Context(), "feature_api_test")

		var message string
		if enabled {
			message = "BACKEND FEATURE IS ON"
		} else {
			message = "BACKEND FEATURE IS OFF"
		}

		c.JSON(http.StatusOK, gin.H{"message": message})
	}
}
