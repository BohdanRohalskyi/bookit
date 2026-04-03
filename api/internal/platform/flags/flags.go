package flags

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"golang.org/x/oauth2/google"
)

// Service provides feature flag functionality using Firebase Remote Config.
type Service struct {
	projectID string
	client    *http.Client
	template  *Template
	mu        sync.RWMutex
	lastFetch time.Time
	cacheTTL  time.Duration
}

// Template represents the Remote Config template.
type Template struct {
	Parameters map[string]Parameter `json:"parameters"`
}

// Parameter represents a single Remote Config parameter.
type Parameter struct {
	DefaultValue ParameterValue `json:"defaultValue"`
	ValueType    string         `json:"valueType"`
}

// ParameterValue represents a parameter's value.
type ParameterValue struct {
	Value string `json:"value"`
}

// NewService creates a new feature flag service.
func NewService(ctx context.Context, projectID string) (*Service, error) {
	// Create HTTP client with default credentials
	client, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/firebase.remoteconfig")
	if err != nil {
		return nil, fmt.Errorf("create http client: %w", err)
	}

	svc := &Service{
		projectID: projectID,
		client:    client,
		cacheTTL:  5 * time.Minute,
	}

	// Load initial flags
	if err := svc.refresh(ctx); err != nil {
		log.Printf("warning: failed to fetch initial flags: %v", err)
	}

	return svc, nil
}

func (s *Service) refresh(ctx context.Context) error {
	url := fmt.Sprintf("https://firebaseremoteconfig.googleapis.com/v1/projects/%s/remoteConfig", s.projectID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	// Set quota project header
	req.Header.Set("x-goog-user-project", s.projectID)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch remote config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("unexpected status %d (failed to read body: %v)", resp.StatusCode, err)
		}
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var template Template
	if err := json.NewDecoder(resp.Body).Decode(&template); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	s.mu.Lock()
	s.template = &template
	s.lastFetch = time.Now()
	s.mu.Unlock()

	return nil
}

// IsEnabled returns whether a boolean feature flag is enabled.
func (s *Service) IsEnabled(ctx context.Context, name string) bool {
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

	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.template == nil {
		return false
	}

	param, ok := s.template.Parameters[name]
	if !ok {
		return false
	}

	return param.DefaultValue.Value == "true"
}

// GetString returns the string value of a feature flag.
func (s *Service) GetString(ctx context.Context, name string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.template == nil {
		return ""
	}

	param, ok := s.template.Parameters[name]
	if !ok {
		return ""
	}

	return param.DefaultValue.Value
}

// GetAll returns all feature flags as a map.
func (s *Service) GetAll(ctx context.Context) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]interface{})
	if s.template == nil {
		return result
	}

	for name, param := range s.template.Parameters {
		if param.ValueType == "BOOLEAN" {
			result[name] = param.DefaultValue.Value == "true"
		} else {
			result[name] = param.DefaultValue.Value
		}
	}

	return result
}
