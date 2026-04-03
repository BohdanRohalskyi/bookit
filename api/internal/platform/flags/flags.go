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
// Uses the Server-side Remote Config API.
type Service struct {
	projectID string
	client    *http.Client
	flags     map[string]Parameter
	mu        sync.RWMutex
	lastFetch time.Time
	cacheTTL  time.Duration
}

// serverTemplate represents the Server Remote Config template response.
type serverTemplate struct {
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
	client, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return nil, fmt.Errorf("create http client: %w", err)
	}

	svc := &Service{
		projectID: projectID,
		client:    client,
		flags:     make(map[string]Parameter),
		cacheTTL:  5 * time.Minute,
	}

	// Load initial flags
	if err := svc.refresh(ctx); err != nil {
		return nil, fmt.Errorf("fetch initial flags: %w", err)
	}

	return svc, nil
}

func (s *Service) refresh(ctx context.Context) error {
	// Fetch server-side Remote Config template
	url := fmt.Sprintf("https://firebaseremoteconfig.googleapis.com/v1/projects/%s/remoteConfig:downloadDefaults?format=JSON", s.projectID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
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

	// Parse as simple key-value map (downloadDefaults returns flat JSON)
	var defaults map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&defaults); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	// Convert to our internal format
	flags := make(map[string]Parameter)
	for name, value := range defaults {
		flags[name] = Parameter{
			DefaultValue: ParameterValue{Value: value},
			ValueType:    "STRING", // downloadDefaults returns strings
		}
	}

	s.mu.Lock()
	s.flags = flags
	s.lastFetch = time.Now()
	s.mu.Unlock()

	log.Printf("loaded %d server-side feature flags", len(flags))
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

// IsEnabled returns whether a boolean feature flag is enabled.
func (s *Service) IsEnabled(ctx context.Context, name string) bool {
	s.maybeRefresh(ctx)

	s.mu.RLock()
	defer s.mu.RUnlock()

	param, ok := s.flags[name]
	if !ok {
		return false
	}

	return param.DefaultValue.Value == "true"
}

// GetString returns the string value of a feature flag.
func (s *Service) GetString(ctx context.Context, name string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	param, ok := s.flags[name]
	if !ok {
		return ""
	}

	return param.DefaultValue.Value
}

// GetAll returns all feature flags as a map.
func (s *Service) GetAll(ctx context.Context) map[string]interface{} {
	s.maybeRefresh(ctx)

	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]interface{})
	for name, param := range s.flags {
		value := param.DefaultValue.Value
		// Try to interpret as boolean
		if value == "true" {
			result[name] = true
		} else if value == "false" {
			result[name] = false
		} else {
			result[name] = value
		}
	}

	return result
}
