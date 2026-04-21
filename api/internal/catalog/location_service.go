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
func (s *LocationService) ownsBusinessID(ctx context.Context, userID, businessID int64) error {
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

// memberAccess returns nil if the user is the business owner (full access),
// or a *MemberAccess describing their role and location restrictions.
// Returns ErrNotOwner if the user has neither ownership nor a role assignment.
func (s *LocationService) memberAccess(ctx context.Context, userID, businessID int64) (*MemberAccess, error) {
	if err := s.ownsBusinessID(ctx, userID, businessID); err == nil {
		return nil, nil
	}
	access, err := s.repo.GetMemberAccess(ctx, userID, businessID)
	if err != nil {
		return nil, ErrNotOwner
	}
	return &access, nil
}

func containsID(ids []int64, id int64) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}

// canReadLocation passes for owners and any role-assigned member with access to locationID.
func (s *LocationService) canReadLocation(ctx context.Context, userID, locationID int64) error {
	businessID, err := s.repo.GetOwnerBusinessID(ctx, locationID)
	if err != nil {
		return err
	}
	access, err := s.memberAccess(ctx, userID, businessID)
	if err != nil {
		return err
	}
	if access != nil && access.Restricted && !containsID(access.LocationIDs, locationID) {
		return ErrLocationNotOwner
	}
	return nil
}

// canEditLocation passes for owners and administrators with access to locationID.
func (s *LocationService) canEditLocation(ctx context.Context, userID, locationID int64) error {
	businessID, err := s.repo.GetOwnerBusinessID(ctx, locationID)
	if err != nil {
		return err
	}
	access, err := s.memberAccess(ctx, userID, businessID)
	if err != nil {
		return err
	}
	if access != nil {
		if access.Role != "administrator" {
			return ErrLocationNotOwner
		}
		if access.Restricted && !containsID(access.LocationIDs, locationID) {
			return ErrLocationNotOwner
		}
	}
	return nil
}

// ownsLocationID checks that the user owns the location's parent business.
func (s *LocationService) ownsLocationID(ctx context.Context, userID, locationID int64) error {
	businessID, err := s.repo.GetOwnerBusinessID(ctx, locationID)
	if err != nil {
		return err
	}
	return s.ownsBusinessID(ctx, userID, businessID)
}

func (s *LocationService) CreateLocation(ctx context.Context, userID int64, req LocationCreate) (Location, error) {
	if err := s.ownsBusinessID(ctx, userID, req.BusinessID); err != nil {
		return Location{}, err
	}
	return s.repo.Create(ctx, req)
}

func (s *LocationService) ListLocations(ctx context.Context, userID, businessID int64, page, perPage int) ([]Location, int, error) {
	access, err := s.memberAccess(ctx, userID, businessID)
	if err != nil {
		return nil, 0, err
	}
	if access == nil || !access.Restricted {
		return s.repo.ListByBusinessID(ctx, businessID, page, perPage)
	}
	return s.repo.ListByIDs(ctx, access.LocationIDs, page, perPage)
}

func (s *LocationService) GetLocation(ctx context.Context, id int64, userID int64) (Location, error) {
	l, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return Location{}, err
	}
	access, err := s.memberAccess(ctx, userID, l.BusinessID)
	if err != nil {
		return Location{}, err
	}
	if access != nil && access.Restricted && !containsID(access.LocationIDs, id) {
		return Location{}, ErrLocationNotOwner
	}
	return l, nil
}

func (s *LocationService) UpdateLocation(ctx context.Context, id int64, userID int64, req LocationUpdate) (Location, error) {
	businessID, err := s.repo.GetOwnerBusinessID(ctx, id)
	if err != nil {
		return Location{}, err
	}
	access, err := s.memberAccess(ctx, userID, businessID)
	if err != nil {
		return Location{}, err
	}
	if access != nil {
		if access.Role != "administrator" {
			return Location{}, ErrLocationNotOwner
		}
		if access.Restricted && !containsID(access.LocationIDs, id) {
			return Location{}, ErrLocationNotOwner
		}
	}
	return s.repo.Update(ctx, id, req)
}

func (s *LocationService) DeleteLocation(ctx context.Context, id int64, userID int64) error {
	if err := s.ownsLocationID(ctx, userID, id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

func (s *LocationService) GetSchedule(ctx context.Context, locationID int64, userID int64) (Schedule, error) {
	if err := s.canReadLocation(ctx, userID, locationID); err != nil {
		return Schedule{}, err
	}
	return s.repo.GetSchedule(ctx, locationID)
}

func (s *LocationService) UpsertScheduleDays(ctx context.Context, locationID int64, userID int64, days []ScheduleDayInput) (Schedule, error) {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return Schedule{}, err
	}
	return s.repo.UpsertScheduleDays(ctx, locationID, days)
}

func (s *LocationService) ListExceptions(ctx context.Context, locationID int64, userID int64) ([]ScheduleException, error) {
	if err := s.canReadLocation(ctx, userID, locationID); err != nil {
		return nil, err
	}
	return s.repo.ListExceptions(ctx, locationID)
}

func (s *LocationService) CreateException(ctx context.Context, locationID int64, userID int64, req ScheduleExceptionCreate) (ScheduleException, error) {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return ScheduleException{}, err
	}
	return s.repo.CreateException(ctx, locationID, req)
}

func (s *LocationService) DeleteException(ctx context.Context, locationID int64, exceptionID int64, userID int64) error {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return err
	}
	return s.repo.DeleteException(ctx, exceptionID)
}

// ─── Photos ───────────────────────────────────────────────────────────────────

func (s *LocationService) ListPhotos(ctx context.Context, locationID int64, userID int64) ([]LocationPhoto, error) {
	if err := s.canReadLocation(ctx, userID, locationID); err != nil {
		return nil, err
	}
	return s.repo.ListPhotos(ctx, locationID)
}

func (s *LocationService) UploadPhoto(ctx context.Context, locationID int64, userID int64, r io.Reader, contentType, ext string) (LocationPhoto, error) {
	if s.storage == nil {
		return LocationPhoto{}, ErrStorageNotConfigured
	}
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return LocationPhoto{}, err
	}
	// photoID is a GCS object name component — kept as uuid.New() intentionally (not a DB PK)
	photoID := uuid.New()
	objectName := fmt.Sprintf("locations/%d/photos/%s%s", locationID, photoID, ext)
	url, err := s.storage.UploadFile(ctx, objectName, r, contentType)
	if err != nil {
		return LocationPhoto{}, fmt.Errorf("upload photo: %w", err)
	}
	return s.repo.CreatePhoto(ctx, locationID, url)
}

func (s *LocationService) DeletePhoto(ctx context.Context, locationID int64, photoID int64, userID int64) error {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
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
