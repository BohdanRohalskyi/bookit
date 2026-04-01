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
}

func Load() (*Config, error) {
	// Load .env file in local environment only
	// In staging/prod, env vars are injected by Cloud Run
	if os.Getenv("ENVIRONMENT") == "" {
		_ = godotenv.Load() //nolint:errcheck // .env is optional, ignore if missing
	}

	cfg := &Config{
		Environment: getEnv("ENVIRONMENT", "local"),
		APIPort:     getEnvAsInt("API_PORT", 8080),
		LogLevel:    getEnv("LOG_LEVEL", "info"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		GCPProject:  os.Getenv("GCP_PROJECT"),
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
