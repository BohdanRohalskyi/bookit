package catalog

import (
	"context"

	"github.com/google/uuid"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
)

// CatalogService handles ownership and business logic for business-level catalog
// entities (equipment, staff roles, services) and branch-level pivot tables.
type CatalogService struct {
	repo         *CatalogRepository
	bizRepo      *Repository
	identityRepo *identity.Repository
	branchRepo   *BranchRepository
}

func NewCatalogService(repo *CatalogRepository, bizRepo *Repository, identityRepo *identity.Repository, branchRepo *BranchRepository) *CatalogService {
	return &CatalogService{repo: repo, bizRepo: bizRepo, identityRepo: identityRepo, branchRepo: branchRepo}
}

// ownsBusinessID verifies the user is a provider who owns the given business.
func (s *CatalogService) ownsBusinessID(ctx context.Context, userID, businessID uuid.UUID) error {
	providerID, err := s.identityRepo.GetProviderIDByUserID(ctx, userID)
	if err != nil {
		return ErrNotProvider
	}
	biz, err := s.bizRepo.GetByID(ctx, businessID)
	if err != nil {
		return ErrBusinessNotFound
	}
	if biz.ProviderID != providerID {
		return ErrNotOwner
	}
	return nil
}

// ownsBranchID verifies the user owns the branch's parent business.
func (s *CatalogService) ownsBranchID(ctx context.Context, userID, branchID uuid.UUID) error {
	businessID, err := s.branchRepo.GetOwnerBusinessID(ctx, branchID)
	if err != nil {
		return ErrBranchNotFound
	}
	return s.ownsBusinessID(ctx, userID, businessID)
}

// ─── Equipment ────────────────────────────────────────────────────────────────

func (s *CatalogService) CreateEquipment(ctx context.Context, userID uuid.UUID, req EquipmentCreate) (Equipment, error) {
	if err := s.ownsBusinessID(ctx, userID, req.BusinessID); err != nil {
		return Equipment{}, err
	}
	return s.repo.CreateEquipment(ctx, req)
}

func (s *CatalogService) ListEquipment(ctx context.Context, userID, businessID uuid.UUID) ([]Equipment, error) {
	if err := s.ownsBusinessID(ctx, userID, businessID); err != nil {
		return nil, err
	}
	return s.repo.ListEquipmentByBusiness(ctx, businessID)
}

func (s *CatalogService) DeleteEquipment(ctx context.Context, userID, id uuid.UUID) error {
	businessID, err := s.repo.GetEquipmentBusinessID(ctx, id)
	if err != nil {
		return err
	}
	return s.ownsBusinessID(ctx, userID, businessID)
}

func (s *CatalogService) DeleteEquipmentExec(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteEquipment(ctx, id)
}

// ─── Staff roles ──────────────────────────────────────────────────────────────

func (s *CatalogService) CreateStaffRole(ctx context.Context, userID uuid.UUID, req StaffRoleCreate) (StaffRole, error) {
	if err := s.ownsBusinessID(ctx, userID, req.BusinessID); err != nil {
		return StaffRole{}, err
	}
	return s.repo.CreateStaffRole(ctx, req)
}

func (s *CatalogService) ListStaffRoles(ctx context.Context, userID, businessID uuid.UUID) ([]StaffRole, error) {
	if err := s.ownsBusinessID(ctx, userID, businessID); err != nil {
		return nil, err
	}
	return s.repo.ListStaffRolesByBusiness(ctx, businessID)
}

func (s *CatalogService) DeleteStaffRole(ctx context.Context, userID, id uuid.UUID) error {
	businessID, err := s.repo.GetStaffRoleBusinessID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.ownsBusinessID(ctx, userID, businessID); err != nil {
		return err
	}
	return s.repo.DeleteStaffRole(ctx, id)
}

// ─── Services ─────────────────────────────────────────────────────────────────

func (s *CatalogService) CreateService(ctx context.Context, userID uuid.UUID, req ServiceItemCreate) (ServiceItem, error) {
	if err := s.ownsBusinessID(ctx, userID, req.BusinessID); err != nil {
		return ServiceItem{}, err
	}
	return s.repo.CreateService(ctx, req)
}

func (s *CatalogService) ListServices(ctx context.Context, userID, businessID uuid.UUID) ([]ServiceItem, error) {
	if err := s.ownsBusinessID(ctx, userID, businessID); err != nil {
		return nil, err
	}
	return s.repo.ListServicesByBusiness(ctx, businessID)
}

func (s *CatalogService) DeleteService(ctx context.Context, userID, id uuid.UUID) error {
	businessID, err := s.repo.GetServiceBusinessID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.ownsBusinessID(ctx, userID, businessID); err != nil {
		return err
	}
	return s.repo.DeleteService(ctx, id)
}

// ─── Branch pivots ────────────────────────────────────────────────────────────

func (s *CatalogService) AddBranchEquipment(ctx context.Context, userID, branchID uuid.UUID, req BranchEquipmentCreate) (BranchEquipment, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return BranchEquipment{}, err
	}
	return s.repo.AddBranchEquipment(ctx, branchID, req)
}

func (s *CatalogService) ListBranchEquipment(ctx context.Context, userID, branchID uuid.UUID) ([]BranchEquipment, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return nil, err
	}
	return s.repo.ListBranchEquipment(ctx, branchID)
}

func (s *CatalogService) RemoveBranchEquipment(ctx context.Context, userID, branchID, itemID uuid.UUID) error {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return err
	}
	ownerID, err := s.repo.GetBranchEquipmentBranchID(ctx, itemID)
	if err != nil {
		return err
	}
	if ownerID != branchID {
		return ErrBranchNotOwner
	}
	return s.repo.RemoveBranchEquipment(ctx, itemID)
}

func (s *CatalogService) AddBranchStaffRole(ctx context.Context, userID, branchID uuid.UUID, req BranchStaffRoleCreate) (BranchStaffRole, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return BranchStaffRole{}, err
	}
	return s.repo.AddBranchStaffRole(ctx, branchID, req)
}

func (s *CatalogService) ListBranchStaffRoles(ctx context.Context, userID, branchID uuid.UUID) ([]BranchStaffRole, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return nil, err
	}
	return s.repo.ListBranchStaffRoles(ctx, branchID)
}

func (s *CatalogService) RemoveBranchStaffRole(ctx context.Context, userID, branchID, itemID uuid.UUID) error {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return err
	}
	ownerID, err := s.repo.GetBranchStaffRoleBranchID(ctx, itemID)
	if err != nil {
		return err
	}
	if ownerID != branchID {
		return ErrBranchNotOwner
	}
	return s.repo.RemoveBranchStaffRole(ctx, itemID)
}

func (s *CatalogService) AddBranchService(ctx context.Context, userID, branchID uuid.UUID, req BranchServiceItemCreate) (BranchServiceItem, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return BranchServiceItem{}, err
	}
	return s.repo.AddBranchService(ctx, branchID, req)
}

func (s *CatalogService) ListBranchServices(ctx context.Context, userID, branchID uuid.UUID) ([]BranchServiceItem, error) {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return nil, err
	}
	return s.repo.ListBranchServices(ctx, branchID)
}

func (s *CatalogService) RemoveBranchService(ctx context.Context, userID, branchID, itemID uuid.UUID) error {
	if err := s.ownsBranchID(ctx, userID, branchID); err != nil {
		return err
	}
	ownerID, err := s.repo.GetBranchServiceBranchID(ctx, itemID)
	if err != nil {
		return err
	}
	if ownerID != branchID {
		return ErrBranchNotOwner
	}
	return s.repo.RemoveBranchService(ctx, itemID)
}
