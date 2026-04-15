package catalog

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrBusinessNotFound = errors.New("business not found")
	ErrNotOwner         = errors.New("not the business owner")
	ErrNotProvider      = errors.New("user is not a provider")
	ErrStorageNotConfigured = errors.New("logo upload not available in this environment")
)

// Business is the full business entity returned from the DB.
type Business struct {
	ID          uuid.UUID
	ProviderID  uuid.UUID
	Name        string
	Category    string
	Description *string
	LogoURL     *string
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// BusinessCreate holds fields for a new business.
type BusinessCreate struct {
	Name        string
	Category    string
	Description *string
	LogoURL     *string
}

// BusinessUpdate holds optional fields for a partial update.
type BusinessUpdate struct {
	Name        *string
	Description *string
	LogoURL     *string
	IsActive    *bool
}
