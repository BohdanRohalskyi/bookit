package flags

import (
	"context"
	"log"
	"sync"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/remoteconfig"
)

// Service provides feature flag functionality using Firebase Remote Config Server SDK.
type Service struct {
	template  *remoteconfig.ServerTemplate
	mu        sync.RWMutex
	lastFetch time.Time
	cacheTTL  time.Duration
}

// NewService creates a new feature flag service using the proper Firebase Admin SDK.
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

	// Get server template - this fetches from Server-side Remote Config
	template, err := client.GetServerTemplate(ctx, nil)
	if err != nil {
		return nil, err
	}

	svc := &Service{
		template: template,
		cacheTTL: 1 * time.Minute,
	}

	// Load initial values
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

func (s *Service) maybeRefresh(ctx context.Context) {
	s.mu.RLock()
	needsRefresh := time.Since(s.lastFetch) > s.cacheTTL
	s.mu.RUnlock()

	if needsRefresh {
		go func() {
			refreshCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := s.refresh(refreshCtx); err != nil {
				log.Printf("warning: failed to refresh flags: %v", err)
			}
		}()
	}
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
	s.maybeRefresh(ctx)

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

// GetAll returns all feature flags.
// Note: The SDK doesn't provide a way to enumerate all flags,
// so this returns an empty map. Use IsEnabled() for specific flags.
func (s *Service) GetAll(ctx context.Context) map[string]interface{} {
	// The Firebase Admin SDK doesn't expose a way to list all parameter names
	// from ServerConfig. For the /flags endpoint, we return empty.
	// Use IsEnabled("flag_name") in your code to check specific flags.
	return map[string]interface{}{}
}
