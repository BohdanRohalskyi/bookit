package catalog

import (
	"context"
	"fmt"
	"io"

	"github.com/google/uuid"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
)

// LocationService handles business logic for locations, schedules, and photos.
type LocationService struct {
	repo         *LocationRepository
	identityRepo *identity.Repository
	bizRepo      *Repository // to resolve provider → business ownership
	storage      StorageUploader
}

func NewLocationService(repo *LocationRepository, identityRepo *identity.Repository, bizRepo *Repository, storage StorageUploader) *LocationService {
	return &LocationService{repo: repo, identityRepo: identityRepo, bizRepo: bizRepo, storage: storage}
}

// ownsBusinessID checks that the authenticated user is a provider who owns businessID.
func (s *LocationService) ownsBusinessID(ctx context.Context, userID, businessID uuid.UUID) error {
	providerID, err := s.identityRepo.GetProviderIDByUserID(ctx, userID)
	if err != nil {
		return ErrNotProvider
	}
	// Fetch business and verify provider_id matches
	biz, err := s.bizRepo.GetByID(ctx, businessID)
	if err != nil {
		return ErrBusinessNotFound
	}
	if biz.ProviderID != providerID {
		return ErrLocationNotOwner
	}
	return nil
}

// canAccessBusinessID passes for providers and role-assigned members (admin/staff).
func (s *LocationService) canAccessBusinessID(ctx context.Context, userID, businessID uuid.UUID) error {
	ok, err := s.repo.IsMemberOrOwner(ctx, userID, businessID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrNotOwner
	}
	return nil
}

// ownsLocationID checks that the user owns the location's parent business.
func (s *LocationService) ownsLocationID(ctx context.Context, userID, locationID uuid.UUID) error {
	businessID, err := s.repo.GetOwnerBusinessID(ctx, locationID)
	if err != nil {
		return err
	}
	return s.ownsBusinessID(ctx, userID, businessID)
}

func (s *LocationService) CreateLocation(ctx context.Context, userID uuid.UUID, req LocationCreate) (Location, error) {
	if err := s.ownsBusinessID(ctx, userID, req.BusinessID); err != nil {
		return Location{}, err
	}
	return s.repo.Create(ctx, req)
}

func (s *LocationService) ListLocations(ctx context.Context, userID, businessID uuid.UUID, page, perPage int) ([]Location, int, error) {
	if err := s.canAccessBusinessID(ctx, userID, businessID); err != nil {
		return nil, 0, err
	}
	return s.repo.ListByBusinessID(ctx, businessID, page, perPage)
}

func (s *LocationService) GetLocation(ctx context.Context, id, userID uuid.UUID) (Location, error) {
	l, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return Location{}, err
	}
	if err := s.canAccessBusinessID(ctx, userID, l.BusinessID); err != nil {
		return Location{}, err
	}
	return l, nil
}

func (s *LocationService) UpdateLocation(ctx context.Context, id, userID uuid.UUID, req LocationUpdate) (Location, error) {
	if err := s.ownsLocationID(ctx, userID, id); err != nil {
		return Location{}, err
	}
	return s.repo.Update(ctx, id, req)
}

func (s *LocationService) DeleteLocation(ctx context.Context, id, userID uuid.UUID) error {
	if err := s.ownsLocationID(ctx, userID, id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

func (s *LocationService) GetSchedule(ctx context.Context, locationID, userID uuid.UUID) (Schedule, error) {
	if err := s.ownsLocationID(ctx, userID, locationID); err != nil {
		return Schedule{}, err
	}
	return s.repo.GetSchedule(ctx, locationID)
}

func (s *LocationService) UpsertScheduleDays(ctx context.Context, locationID, userID uuid.UUID, days []ScheduleDayInput) (Schedule, error) {
	if err := s.ownsLocationID(ctx, userID, locationID); err != nil {
		return Schedule{}, err
	}
	return s.repo.UpsertScheduleDays(ctx, locationID, days)
}

func (s *LocationService) ListExceptions(ctx context.Context, locationID, userID uuid.UUID) ([]ScheduleException, error) {
	if err := s.ownsLocationID(ctx, userID, locationID); err != nil {
		return nil, err
	}
	return s.repo.ListExceptions(ctx, locationID)
}

func (s *LocationService) CreateException(ctx context.Context, locationID, userID uuid.UUID, req ScheduleExceptionCreate) (ScheduleException, error) {
	if err := s.ownsLocationID(ctx, userID, locationID); err != nil {
		return ScheduleException{}, err
	}
	return s.repo.CreateException(ctx, locationID, req)
}

func (s *LocationService) DeleteException(ctx context.Context, locationID, exceptionID, userID uuid.UUID) error {
	if err := s.ownsLocationID(ctx, userID, locationID); err != nil {
		return err
	}
	return s.repo.DeleteException(ctx, exceptionID)
}

// ─── Photos ───────────────────────────────────────────────────────────────────

func (s *LocationService) ListPhotos(ctx context.Context, locationID, userID uuid.UUID) ([]LocationPhoto, error) {
	if err := s.ownsLocationID(ctx, userID, locationID); err != nil {
		return nil, err
	}
	return s.repo.ListPhotos(ctx, locationID)
}

func (s *LocationService) UploadPhoto(ctx context.Context, locationID, userID uuid.UUID, r io.Reader, contentType, ext string) (LocationPhoto, error) {
	if s.storage == nil {
		return LocationPhoto{}, ErrStorageNotConfigured
	}
	if err := s.ownsLocationID(ctx, userID, locationID); err != nil {
		return LocationPhoto{}, err
	}
	photoID := uuid.New()
	objectName := fmt.Sprintf("locations/%s/photos/%s%s", locationID, photoID, ext)
	url, err := s.storage.UploadFile(ctx, objectName, r, contentType)
	if err != nil {
		return LocationPhoto{}, fmt.Errorf("upload photo: %w", err)
	}
	return s.repo.CreatePhoto(ctx, locationID, url)
}

func (s *LocationService) DeletePhoto(ctx context.Context, locationID, photoID, userID uuid.UUID) error {
	if err := s.ownsLocationID(ctx, userID, locationID); err != nil {
		return err
	}
	// Verify the photo belongs to this location
	ownerLocationID, err := s.repo.GetPhotoOwnerLocationID(ctx, photoID)
	if err != nil {
		return err
	}
	if ownerLocationID != locationID {
		return ErrLocationNotOwner
	}
	return s.repo.DeletePhoto(ctx, photoID)
}
