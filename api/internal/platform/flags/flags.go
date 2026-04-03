package flags

import (
	"context"
	"log"
	"sync"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/remoteconfig"
)

// Service provides feature flag functionality using Firebase Remote Config.
type Service struct {
	template  *remoteconfig.ServerTemplate
	mu        sync.RWMutex
	lastFetch time.Time
	cacheTTL  time.Duration
}

// NewService creates a new feature flag service.
func NewService(ctx context.Context, projectID string) (*Service, error) {
	app, err := firebase.NewApp(ctx, &firebase.Config{
		ProjectID: projectID,
	})
	if err != nil {
		return nil, err
	}

	client, err := app.RemoteConfig(ctx)
	if err != nil {
		return nil, err
	}

	// Create template with defaults
	template, err := client.GetServerTemplate(ctx, map[string]any{
		"feature_test": false,
	})
	if err != nil {
		return nil, err
	}

	svc := &Service{
		template: template,
		cacheTTL: 5 * time.Minute,
	}

	// Load initial values from Firebase
	if err := svc.refresh(ctx); err != nil {
		log.Printf("warning: failed to fetch initial flags: %v", err)
	}

	return svc, nil
}

func (s *Service) refresh(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.template.Load(ctx); err != nil {
		return err
	}
	s.lastFetch = time.Now()

	return nil
}

func (s *Service) getConfig() *remoteconfig.ServerConfig {
	config, err := s.template.Evaluate(nil)
	if err != nil {
		log.Printf("warning: failed to evaluate config: %v", err)
		return nil
	}
	return config
}

// IsEnabled returns whether a boolean feature flag is enabled.
func (s *Service) IsEnabled(ctx context.Context, name string) bool {
	s.mu.RLock()
	needsRefresh := time.Since(s.lastFetch) > s.cacheTTL
	s.mu.RUnlock()

	if needsRefresh {
		go func() {
			if err := s.refresh(ctx); err != nil {
				log.Printf("warning: failed to refresh flags: %v", err)
			}
		}()
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	config := s.getConfig()
	if config == nil {
		return false
	}

	return config.GetBoolean(name)
}

// GetString returns the string value of a feature flag.
func (s *Service) GetString(ctx context.Context, name string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	config := s.getConfig()
	if config == nil {
		return ""
	}

	return config.GetString(name)
}

// GetAll returns all feature flags as a map.
// Note: This returns values for known flags only.
func (s *Service) GetAll(ctx context.Context) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]interface{})
	config := s.getConfig()
	if config == nil {
		return result
	}

	// Return known flags - add new flags here as they're created
	knownFlags := []string{"feature_test"}
	for _, name := range knownFlags {
		result[name] = config.GetBoolean(name)
	}

	return result
}
