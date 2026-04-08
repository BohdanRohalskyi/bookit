package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setBaseEnv configures the minimum valid environment for each sub-test.
// t.Setenv automatically restores the original value on test cleanup.
func setBaseEnv(t *testing.T) {
	t.Helper()
	t.Setenv("ENVIRONMENT", "test")
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost/db")
	t.Setenv("JWT_SECRET", "this-is-a-valid-secret-that-is-32chars!!")
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
}

func TestConfig_Validate(t *testing.T) {
	// Do not run in parallel: sub-tests modify the process environment.

	t.Run("passes with all required fields set", func(t *testing.T) {
		setBaseEnv(t)
		cfg, err := Load()
		require.NoError(t, err)
		assert.Equal(t, "test", cfg.Environment)
		assert.Equal(t, []string{"http://localhost:5173"}, cfg.AllowedOrigins)
	})

	t.Run("fails when DATABASE_URL is empty", func(t *testing.T) {
		setBaseEnv(t)
		t.Setenv("DATABASE_URL", "")
		_, err := Load()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "DATABASE_URL")
	})

	t.Run("fails when JWT_SECRET is empty", func(t *testing.T) {
		setBaseEnv(t)
		t.Setenv("JWT_SECRET", "")
		_, err := Load()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "JWT_SECRET")
	})

	t.Run("fails when JWT_SECRET is shorter than 32 characters", func(t *testing.T) {
		setBaseEnv(t)
		t.Setenv("JWT_SECRET", "too-short")
		_, err := Load()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "32 characters")
	})

	t.Run("fails when CORS_ALLOWED_ORIGINS is empty", func(t *testing.T) {
		setBaseEnv(t)
		t.Setenv("CORS_ALLOWED_ORIGINS", "")
		_, err := Load()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "CORS_ALLOWED_ORIGINS")
	})
}

func TestGetEnvAsStringSlice(t *testing.T) {
	// Do not run in parallel: sub-tests modify the process environment.

	t.Run("returns nil for unset key", func(t *testing.T) {
		t.Setenv("TEST_ORIGINS", "")
		assert.Nil(t, getEnvAsStringSlice("TEST_ORIGINS"))
	})

	t.Run("parses comma-separated values", func(t *testing.T) {
		t.Setenv("TEST_ORIGINS", "http://a.com,http://b.com,http://c.com")
		assert.Equal(t,
			[]string{"http://a.com", "http://b.com", "http://c.com"},
			getEnvAsStringSlice("TEST_ORIGINS"),
		)
	})

	t.Run("trims whitespace around entries", func(t *testing.T) {
		t.Setenv("TEST_ORIGINS", " http://a.com , http://b.com ")
		assert.Equal(t,
			[]string{"http://a.com", "http://b.com"},
			getEnvAsStringSlice("TEST_ORIGINS"),
		)
	})

	t.Run("skips empty entries", func(t *testing.T) {
		t.Setenv("TEST_ORIGINS", "http://a.com,,http://b.com")
		assert.Equal(t,
			[]string{"http://a.com", "http://b.com"},
			getEnvAsStringSlice("TEST_ORIGINS"),
		)
	})
}
