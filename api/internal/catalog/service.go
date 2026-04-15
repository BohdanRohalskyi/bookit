package catalog

import (
	"context"
	"fmt"
	"io"

	"github.com/google/uuid"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
)

// StorageUploader abstracts GCS uploads so the service can be tested without real GCS.
type StorageUploader interface {
	UploadFile(ctx context.Context, objectName string, r io.Reader, contentType string) (string, error)
}

// Service implements all business logic for the catalog domain.
type Service struct {
	repo        *Repository
	identityRepo *identity.Repository
	storage     StorageUploader // nil when GCS not configured (local dev)
}

func NewService(repo *Repository, identityRepo *identity.Repository, storage StorageUploader) *Service {
	return &Service{repo: repo, identityRepo: identityRepo, storage: storage}
}

// resolveProviderID looks up the provider ID for the given user, returning
// ErrNotProvider if the user is not a registered provider.
func (s *Service) resolveProviderID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	providerID, err := s.identityRepo.GetProviderIDByUserID(ctx, userID)
	if err != nil {
		return uuid.Nil, ErrNotProvider
	}
	return providerID, nil
}

func (s *Service) CreateBusiness(ctx context.Context, userID uuid.UUID, req BusinessCreate) (Business, error) {
	providerID, err := s.resolveProviderID(ctx, userID)
	if err != nil {
		return Business{}, err
	}
	return s.repo.Create(ctx, providerID, req)
}

func (s *Service) ListBusinesses(ctx context.Context, userID uuid.UUID, page, perPage int) ([]Business, int, error) {
	providerID, err := s.resolveProviderID(ctx, userID)
	if err != nil {
		return nil, 0, err
	}
	return s.repo.ListByProviderID(ctx, providerID, page, perPage)
}

func (s *Service) GetBusiness(ctx context.Context, id, userID uuid.UUID) (Business, error) {
	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return Business{}, err
	}
	providerID, err := s.resolveProviderID(ctx, userID)
	if err != nil {
		return Business{}, err
	}
	if b.ProviderID != providerID {
		return Business{}, ErrNotOwner
	}
	return b, nil
}

func (s *Service) UpdateBusiness(ctx context.Context, id, userID uuid.UUID, req BusinessUpdate) (Business, error) {
	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return Business{}, err
	}
	providerID, err := s.resolveProviderID(ctx, userID)
	if err != nil {
		return Business{}, err
	}
	if b.ProviderID != providerID {
		return Business{}, ErrNotOwner
	}
	return s.repo.Update(ctx, id, req)
}

func (s *Service) DeleteBusiness(ctx context.Context, id, userID uuid.UUID) error {
	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	providerID, err := s.resolveProviderID(ctx, userID)
	if err != nil {
		return err
	}
	if b.ProviderID != providerID {
		return ErrNotOwner
	}
	return s.repo.Delete(ctx, id)
}

func (s *Service) UploadLogo(ctx context.Context, id, userID uuid.UUID, r io.Reader, contentType, ext string) (Business, error) {
	if s.storage == nil {
		return Business{}, ErrStorageNotConfigured
	}

	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return Business{}, err
	}
	providerID, err := s.resolveProviderID(ctx, userID)
	if err != nil {
		return Business{}, err
	}
	if b.ProviderID != providerID {
		return Business{}, ErrNotOwner
	}

	objectName := fmt.Sprintf("businesses/%s/logo%s", id, ext)
	url, err := s.storage.UploadFile(ctx, objectName, r, contentType)
	if err != nil {
		return Business{}, fmt.Errorf("upload: %w", err)
	}

	return s.repo.UpdateLogoURL(ctx, id, url)
}
