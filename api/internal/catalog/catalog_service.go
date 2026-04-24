package catalog

import (
	"context"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
)

// CatalogService handles ownership and business logic for business-level catalog
// entities (equipment, staff roles, services) and location-level pivot tables.
type CatalogService struct {
	repo         *CatalogRepository
	bizRepo      *Repository
	identityRepo *identity.Repository
	locationRepo *LocationRepository
}

func NewCatalogService(repo *CatalogRepository, bizRepo *Repository, identityRepo *identity.Repository, locationRepo *LocationRepository) *CatalogService {
	return &CatalogService{repo: repo, bizRepo: bizRepo, identityRepo: identityRepo, locationRepo: locationRepo}
}

// ownsBusinessID verifies the user is a provider who owns the given business.
func (s *CatalogService) ownsBusinessID(ctx context.Context, userID, businessID int64) error {
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

// memberAccess returns nil if the user is the business owner (full access),
// or a *MemberAccess describing their role and location restrictions.
// Returns ErrNotOwner if the user has neither ownership nor a role assignment.
func (s *CatalogService) memberAccess(ctx context.Context, userID, businessID int64) (*MemberAccess, error) {
	if err := s.ownsBusinessID(ctx, userID, businessID); err == nil {
		return nil, nil
	}
	access, err := s.locationRepo.GetMemberAccess(ctx, userID, businessID)
	if err != nil {
		return nil, ErrNotOwner
	}
	return &access, nil
}

// canReadBusiness passes for owners and any role member of the business.
func (s *CatalogService) canReadBusiness(ctx context.Context, userID, businessID int64) error {
	_, err := s.memberAccess(ctx, userID, businessID)
	return err
}

// canWriteBusiness passes for owners and administrators of the business.
// Staff are denied — they hold no write permissions on catalog items.
func (s *CatalogService) canWriteBusiness(ctx context.Context, userID, businessID int64) error {
	access, err := s.memberAccess(ctx, userID, businessID)
	if err != nil {
		return err
	}
	if access != nil && access.Role != "administrator" {
		return ErrNotOwner
	}
	return nil
}

// canReadLocation passes for owners and any role member with access to locationID.
func (s *CatalogService) canReadLocation(ctx context.Context, userID, locationID int64) error {
	businessID, err := s.locationRepo.GetOwnerBusinessID(ctx, locationID)
	if err != nil {
		return ErrLocationNotFound
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
func (s *CatalogService) canEditLocation(ctx context.Context, userID, locationID int64) error {
	businessID, err := s.locationRepo.GetOwnerBusinessID(ctx, locationID)
	if err != nil {
		return ErrLocationNotFound
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

// ─── Equipment ────────────────────────────────────────────────────────────────

func (s *CatalogService) CreateEquipment(ctx context.Context, userID int64, req EquipmentCreate) (Equipment, error) {
	if err := s.canWriteBusiness(ctx, userID, req.BusinessID); err != nil {
		return Equipment{}, err
	}
	return s.repo.CreateEquipment(ctx, req)
}

func (s *CatalogService) ListEquipment(ctx context.Context, userID, businessID int64) ([]Equipment, error) {
	if err := s.canReadBusiness(ctx, userID, businessID); err != nil {
		return nil, err
	}
	return s.repo.ListEquipmentByBusiness(ctx, businessID)
}

func (s *CatalogService) UpdateEquipment(ctx context.Context, userID, id int64, name string) (Equipment, error) {
	businessID, err := s.repo.GetEquipmentBusinessID(ctx, id)
	if err != nil {
		return Equipment{}, err
	}
	if err := s.canWriteBusiness(ctx, userID, businessID); err != nil {
		return Equipment{}, err
	}
	return s.repo.UpdateEquipment(ctx, id, name)
}

func (s *CatalogService) DeleteEquipment(ctx context.Context, userID, id int64) error {
	businessID, err := s.repo.GetEquipmentBusinessID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.ownsBusinessID(ctx, userID, businessID); err != nil {
		return err
	}
	inUse, err := s.repo.IsEquipmentInUse(ctx, id)
	if err != nil {
		return err
	}
	if inUse {
		return ErrEquipmentInUse
	}
	return nil
}

func (s *CatalogService) DeleteEquipmentExec(ctx context.Context, id int64) error {
	return s.repo.DeleteEquipment(ctx, id)
}

// ─── Staff roles ──────────────────────────────────────────────────────────────

func (s *CatalogService) CreateStaffRole(ctx context.Context, userID int64, req StaffRoleCreate) (StaffRole, error) {
	if err := s.canWriteBusiness(ctx, userID, req.BusinessID); err != nil {
		return StaffRole{}, err
	}
	return s.repo.CreateStaffRole(ctx, req)
}

func (s *CatalogService) ListStaffRoles(ctx context.Context, userID, businessID int64) ([]StaffRole, error) {
	if err := s.canReadBusiness(ctx, userID, businessID); err != nil {
		return nil, err
	}
	return s.repo.ListStaffRolesByBusiness(ctx, businessID)
}

func (s *CatalogService) DeleteStaffRole(ctx context.Context, userID, id int64) error {
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

func (s *CatalogService) CreateService(ctx context.Context, userID int64, req ServiceItemCreate) (ServiceItem, error) {
	if err := s.canWriteBusiness(ctx, userID, req.BusinessID); err != nil {
		return ServiceItem{}, err
	}
	return s.repo.CreateService(ctx, req)
}

func (s *CatalogService) ListServices(ctx context.Context, userID, businessID int64) ([]ServiceItem, error) {
	if err := s.canReadBusiness(ctx, userID, businessID); err != nil {
		return nil, err
	}
	return s.repo.ListServicesByBusiness(ctx, businessID)
}

func (s *CatalogService) UpdateService(ctx context.Context, userID, id int64, req ServiceItemUpdate) (ServiceItem, error) {
	businessID, err := s.repo.GetServiceBusinessID(ctx, id)
	if err != nil {
		return ServiceItem{}, err
	}
	if err := s.canWriteBusiness(ctx, userID, businessID); err != nil {
		return ServiceItem{}, err
	}
	return s.repo.UpdateService(ctx, id, req)
}

func (s *CatalogService) DeleteService(ctx context.Context, userID, id int64) error {
	businessID, err := s.repo.GetServiceBusinessID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.ownsBusinessID(ctx, userID, businessID); err != nil {
		return err
	}
	return s.repo.DeleteService(ctx, id)
}

// ─── Location pivots ──────────────────────────────────────────────────────────

func (s *CatalogService) AddLocationEquipment(ctx context.Context, userID, locationID int64, req LocationEquipmentCreate) (LocationEquipment, error) {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return LocationEquipment{}, err
	}
	return s.repo.AddLocationEquipment(ctx, locationID, req)
}

func (s *CatalogService) ListLocationEquipment(ctx context.Context, userID, locationID int64) ([]LocationEquipment, error) {
	if err := s.canReadLocation(ctx, userID, locationID); err != nil {
		return nil, err
	}
	return s.repo.ListLocationEquipment(ctx, locationID)
}

func (s *CatalogService) RemoveLocationEquipment(ctx context.Context, userID, locationID, itemID int64) error {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return err
	}
	ownerID, err := s.repo.GetLocationEquipmentLocationID(ctx, itemID)
	if err != nil {
		return err
	}
	if ownerID != locationID {
		return ErrLocationNotOwner
	}
	return s.repo.RemoveLocationEquipment(ctx, itemID)
}

func (s *CatalogService) AddLocationStaffRole(ctx context.Context, userID, locationID int64, req LocationStaffRoleCreate) (LocationStaffRole, error) {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return LocationStaffRole{}, err
	}
	return s.repo.AddLocationStaffRole(ctx, locationID, req)
}

func (s *CatalogService) ListLocationStaffRoles(ctx context.Context, userID, locationID int64) ([]LocationStaffRole, error) {
	if err := s.canReadLocation(ctx, userID, locationID); err != nil {
		return nil, err
	}
	return s.repo.ListLocationStaffRoles(ctx, locationID)
}

func (s *CatalogService) RemoveLocationStaffRole(ctx context.Context, userID, locationID, itemID int64) error {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return err
	}
	ownerID, err := s.repo.GetLocationStaffRoleLocationID(ctx, itemID)
	if err != nil {
		return err
	}
	if ownerID != locationID {
		return ErrLocationNotOwner
	}
	return s.repo.RemoveLocationStaffRole(ctx, itemID)
}

func (s *CatalogService) AddLocationService(ctx context.Context, userID, locationID int64, req LocationServiceItemCreate) (LocationServiceItem, error) {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return LocationServiceItem{}, err
	}
	return s.repo.AddLocationService(ctx, locationID, req)
}

func (s *CatalogService) ListLocationServices(ctx context.Context, userID, locationID int64) ([]LocationServiceItem, error) {
	if err := s.canReadLocation(ctx, userID, locationID); err != nil {
		return nil, err
	}
	return s.repo.ListLocationServices(ctx, locationID)
}

func (s *CatalogService) RemoveLocationService(ctx context.Context, userID, locationID, itemID int64) error {
	if err := s.canEditLocation(ctx, userID, locationID); err != nil {
		return err
	}
	ownerID, err := s.repo.GetLocationServiceLocationID(ctx, itemID)
	if err != nil {
		return err
	}
	if ownerID != locationID {
		return ErrLocationNotOwner
	}
	return s.repo.RemoveLocationService(ctx, itemID)
}
