package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/BohdanRohalskyi/bookit/api/internal/auth"
	"github.com/BohdanRohalskyi/bookit/api/internal/catalog"
	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
	"github.com/BohdanRohalskyi/bookit/api/internal/mail"
	"github.com/BohdanRohalskyi/bookit/api/internal/platform/config"
	"github.com/BohdanRohalskyi/bookit/api/internal/platform/database"
	"github.com/BohdanRohalskyi/bookit/api/internal/platform/flags"
	"github.com/BohdanRohalskyi/bookit/api/internal/platform/storage"
	"github.com/BohdanRohalskyi/bookit/api/internal/platform/logger"
	"github.com/BohdanRohalskyi/bookit/api/internal/platform/migrate"
)

var version = "1.0.2"

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
	log := logger.New(cfg.Environment, cfg.LogLevel)
	slog.SetDefault(log)

	// Set Gin mode based on environment
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	// Run migrations if enabled
	if cfg.AutoMigrate {
		log.Info("running database migrations")
		if err := migrate.Run(cfg.DatabaseURL, "migrations"); err != nil {
			return fmt.Errorf("run migrations: %w", err)
		}
		log.Info("migrations completed")
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
	router.Use(corsMiddleware(cfg.AllowedOrigins))

	// Health endpoint
	router.GET("/api/v1/health", healthHandler(db))

	// Feature flags endpoint
	router.GET("/api/v1/flags", flagsHandler(flagService))

	// Feature test endpoint - demonstrates server-side flag usage
	router.GET("/api/v1/feature-test", featureTestHandler(flagService))

	// Initialize mail provider
	var mailProvider mail.Provider
	if cfg.MailProvider == "sendgrid" {
		mailProvider = mail.NewSendGridProvider(cfg.SendGridAPIKey, cfg.MailFrom)
		log.Info("using SendGrid mail provider")
	} else {
		mailProvider = mail.NewSMTPProvider(mail.SMTPConfig{
			Host: cfg.SMTPHost,
			Port: cfg.SMTPPort,
			From: cfg.MailFrom,
		})
		log.Info("using SMTP mail provider", "host", cfg.SMTPHost, "port", cfg.SMTPPort)
	}
	mailTemplates := mail.NewTemplates(cfg.AppURL)

	// Auth endpoints
	userRepo := identity.NewRepository(db.Pool)
	authService := auth.NewService(userRepo, cfg.JWTSecret, mailProvider, mailTemplates)
	authHandler := auth.NewHandler(authService)

	authGroup := router.Group("/api/v1/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
		authGroup.POST("/refresh", authHandler.Refresh)
		authGroup.POST("/logout", authHandler.Logout)
		authGroup.POST("/verify-email", authHandler.VerifyEmail)
		authGroup.POST("/forgot-password", authHandler.ForgotPassword)
		authGroup.POST("/reset-password", authHandler.ResetPassword)
	}

	// Protected auth routes
	authProtected := router.Group("/api/v1/auth")
	authProtected.Use(authHandler.AuthMiddleware())
	{
		authProtected.POST("/resend-verification", authHandler.ResendVerification)
		authProtected.POST("/app-switch-token", authHandler.CreateAppSwitchToken)
	}

	// App switch token exchange (no auth required - token is the auth)
	authGroup.POST("/exchange-app-switch-token", authHandler.ExchangeAppSwitchToken)

	// Provider endpoints (protected)
	providersProtected := router.Group("/api/v1/providers")
	providersProtected.Use(authHandler.AuthMiddleware())
	{
		providersProtected.POST("", authHandler.CreateProvider)
	}

	// Catalog — storage backend (GCS in prod, local filesystem in dev)
	var storageClient catalog.StorageUploader
	if cfg.GCSBucket != "" {
		gcsClient, err := storage.NewClient(ctx, cfg.GCSBucket)
		if err != nil {
			log.Warn("GCS client unavailable — logo upload disabled", "error", err)
		} else {
			storageClient = gcsClient
		}
	} else {
		const uploadsDir = "./uploads"
		apiBaseURL := fmt.Sprintf("http://localhost:%d", cfg.APIPort)
		storageClient = storage.NewLocalClient(uploadsDir, apiBaseURL)
		router.Static("/uploads", uploadsDir)
		log.Info("GCS_BUCKET not set — using local filesystem storage", "dir", uploadsDir)
	}

	catalogRepo := catalog.NewRepository(db.Pool)
	catalogService := catalog.NewService(catalogRepo, userRepo, storageClient)
	catalogHandler := catalog.NewHandler(catalogService)

	businesses := router.Group("/api/v1/businesses")
	businesses.Use(authHandler.AuthMiddleware())
	{
		businesses.GET("", catalogHandler.ListBusinesses)
		businesses.POST("", catalogHandler.CreateBusiness)
		businesses.GET("/:id", catalogHandler.GetBusiness)
		businesses.PUT("/:id", catalogHandler.UpdateBusiness)
		businesses.DELETE("/:id", catalogHandler.DeleteBusiness)
		businesses.POST("/:id/logo", catalogHandler.UploadLogo)
	}

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

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	originSet := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		originSet[o] = true
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if originSet[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
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
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

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
