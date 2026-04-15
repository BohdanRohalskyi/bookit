package catalog

import (
	"context"
	"fmt"
	"io"

	"github.com/google/uuid"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
)

// BranchService handles business logic for branches, schedules, and photos.
type BranchService struct {
	repo         *BranchRepository
	identityRepo *identity.Repository
	bizRepo      *Repository // to resolve provider → business ownership
	storage      StorageUploader
}

func NewBranchService(repo *BranchRepository, identityRepo *identity.Repository, bizRepo *Repository, storage StorageUploader) *BranchService {
	return &BranchService{repo: repo, identityRepo: identityRepo, bizRepo: bizRepo, storage: storage}
}

// ownsBusinessID checks that the authenticated user is a provider who owns businessID.
func (s *BranchService) ownsBusinessID(ctx context.Context, userID, businessID uuid.UUID) error {
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
		return ErrBranchNotOwner
	}
	return nil
}

// ownsBranchID checks that the user owns the branch's parent business.
func (s *BranchService) ownsBranchID(ctx context.Context, userID, branchID uuid.UUID) error {
	businessID, err := s.repo.GetOwnerBusinessID(ctx, branchID)
	if err != nil {
		return err
	}
	return s.ownsBusinessID(ctx, userID, businessID)
}

func (s *BranchService) CreateBranch(ctx context.Context, userID uuid.UUID, req BranchCreate) (Branch, error) {
	if err := s.ownsBusinessID(ctx, userID, req.BusinessID); err != nil {
		return Branch{}, err
	}
	return s.repo.Create(ctx, req)
}

func (s *BranchService) ListBranches(ctx context.Context, userID, businessID uuid.UUID, page, perPage int) ([]Branch, int, error) {
	if err := s.ownsBusinessID(ctx, userID, businessID); err != nil {
		return nil, 0, err
	}
	return s.repo.ListByBusinessID(ctx, businessID, page, perPage)
}

func (s *BranchService) GetBranch(ctx context.Context, id, userID uuid.UUID) (Branch, error) {
	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return Branch{}, err
	}
	if err := s.ownsBusinessID(ctx, userID, b.BusinessID); err != nil {
		return Branch{}, err
	}
	return b, nil
}

func (s *BranchService) UpdateBranch(ctx context.Context, id, userID uuid.UUID, req BranchUpdate) (Branch, error) {
	if err := s.ownsBranchID(ctx, userID, id); err != nil {
		return Branch{}, err
	}
	return s.repo.Update(ctx, id, req)
}

func (s *BranchService) DeleteBranch(ctx context.Context, id, userID uuid.UUID) error {
	if err := s.ownsBranchID(ctx, userID, id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

func (s *BranchService) GetSchedule(ctx context.Context, branchID, userID uuid.UUID) (Schedule, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return Schedule{}, err
	}
	return s.repo.GetSchedule(ctx, branchID)
}

func (s *BranchService) UpsertScheduleDays(ctx context.Context, branchID, userID uuid.UUID, days []ScheduleDayInput) (Schedule, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return Schedule{}, err
	}
	return s.repo.UpsertScheduleDays(ctx, branchID, days)
}

func (s *BranchService) ListExceptions(ctx context.Context, branchID, userID uuid.UUID) ([]ScheduleException, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return nil, err
	}
	return s.repo.ListExceptions(ctx, branchID)
}

func (s *BranchService) CreateException(ctx context.Context, branchID, userID uuid.UUID, req ScheduleExceptionCreate) (ScheduleException, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return ScheduleException{}, err
	}
	return s.repo.CreateException(ctx, branchID, req)
}

func (s *BranchService) DeleteException(ctx context.Context, branchID, exceptionID, userID uuid.UUID) error {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return err
	}
	return s.repo.DeleteException(ctx, exceptionID)
}

// ─── Photos ───────────────────────────────────────────────────────────────────

func (s *BranchService) ListPhotos(ctx context.Context, branchID, userID uuid.UUID) ([]BranchPhoto, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return nil, err
	}
	return s.repo.ListPhotos(ctx, branchID)
}

func (s *BranchService) UploadPhoto(ctx context.Context, branchID, userID uuid.UUID, r io.Reader, contentType, ext string) (BranchPhoto, error) {
	if s.storage == nil {
		return BranchPhoto{}, ErrStorageNotConfigured
	}
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return BranchPhoto{}, err
	}
	photoID := uuid.New()
	objectName := fmt.Sprintf("branches/%s/photos/%s%s", branchID, photoID, ext)
	url, err := s.storage.UploadFile(ctx, objectName, r, contentType)
	if err != nil {
		return BranchPhoto{}, fmt.Errorf("upload photo: %w", err)
	}
	return s.repo.CreatePhoto(ctx, branchID, url)
}

func (s *BranchService) DeletePhoto(ctx context.Context, branchID, photoID, userID uuid.UUID) error {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return err
	}
	// Verify the photo belongs to this branch
	ownerBranchID, err := s.repo.GetPhotoOwnerBranchID(ctx, photoID)
	if err != nil {
		return err
	}
	if ownerBranchID != branchID {
		return ErrBranchNotOwner
	}
	return s.repo.DeletePhoto(ctx, photoID)
}
