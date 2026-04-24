package alpha

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrInvalidRequest = errors.New("invalid request data")

type AccessRequest struct {
	ID          int64
	UUID        uuid.UUID
	Email       string
	CompanyName string
	Description string
	CreatedAt   time.Time
}

type AccessRequestCreate struct {
	Email       string
	CompanyName string
	Description string
}
