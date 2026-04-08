package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Environment string
	APIPort     int
	LogLevel    string
	DatabaseURL string
	JWTSecret   string
	GCPProject  string
	AppURL      string // Frontend URL for email links

	// Database settings
	AutoMigrate bool // Run migrations on startup (local dev only)

	// Mail settings
	MailProvider   string // "smtp" or "sendgrid"
	SMTPHost       string
	SMTPPort       int
	MailFrom       string
	SendGridAPIKey string
}

func Load() (*Config, error) {
	// Load .env file in local environment only
	// In staging/prod, env vars are injected by Cloud Run
	if os.Getenv("ENVIRONMENT") == "" {
		_ = godotenv.Load() //nolint:errcheck // .env is optional, ignore if missing
	}

	env := getEnv("ENVIRONMENT", "local")
	cfg := &Config{
		Environment:    env,
		APIPort:        getEnvAsInt("API_PORT", 8080),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		GCPProject:     os.Getenv("GCP_PROJECT"),
		AppURL:         getEnv("APP_URL", "http://localhost:5173"),
		AutoMigrate:    getEnvAsBool("AUTO_MIGRATE", env == "local"),
		MailProvider:   getEnv("MAIL_PROVIDER", "smtp"),
		SMTPHost:       getEnv("SMTP_HOST", "localhost"),
		SMTPPort:       getEnvAsInt("SMTP_PORT", 1025),
		MailFrom:       getEnv("MAIL_FROM", "noreply@bookit.app"),
		SendGridAPIKey: os.Getenv("SENDGRID_API_KEY"),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}
	return nil
}

func (c *Config) IsLocal() bool {
	return c.Environment == "local"
}

func (c *Config) IsProduction() bool {
	return c.Environment == "prod"
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}
