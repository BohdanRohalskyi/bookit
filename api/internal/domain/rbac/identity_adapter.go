package rbac

import (
	"context"

	"github.com/BohdanRohalskyi/bookit/api/internal/catalog"
	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
)

// IdentityOwnerAdapter bridges identity.Repository and catalog.Repository to
// satisfy the ownerChecker interface used by Service.
//
// Import direction: rbac → identity, rbac → catalog (never the reverse).
type IdentityOwnerAdapter struct {
	identityRepo *identity.Repository
	catalogRepo  *catalog.Repository
}

func NewIdentityOwnerAdapter(identityRepo *identity.Repository, catalogRepo *catalog.Repository) *IdentityOwnerAdapter {
	return &IdentityOwnerAdapter{
		identityRepo: identityRepo,
		catalogRepo:  catalogRepo,
	}
}

// IsBusinessOwner returns true if userID belongs to the provider who owns businessID.
func (a *IdentityOwnerAdapter) IsBusinessOwner(ctx context.Context, userID, businessID int64) (bool, error) {
	providerID, err := a.identityRepo.GetProviderIDByUserID(ctx, userID)
	if err != nil {
		// Not a provider → not an owner. Not a DB error — just return false.
		return false, nil
	}
	businessProviderID, err := a.catalogRepo.GetBusinessProviderID(ctx, businessID)
	if err != nil {
		// Business not found → not an owner.
		return false, nil
	}
	return providerID == businessProviderID, nil
}
