package rbac

import (
	"context"

	"github.com/google/uuid"
)

// ownerChecker abstracts the providers-table ownership check so the service
// can be tested without a real DB and without importing concrete packages.
type ownerChecker interface {
	IsBusinessOwner(ctx context.Context, userID, businessID uuid.UUID) (bool, error)
}

// Service holds the central authorization logic.
type Service struct {
	repo  *PgRepository
	owner ownerChecker
}

func NewService(repo *PgRepository, owner ownerChecker) *Service {
	return &Service{repo: repo, owner: owner}
}

// CanAccess returns nil if the user is authorized to perform resource:action
// within the given scope, or ErrAccessDenied otherwise.
//
// Decision order:
//  1. Is the user the business owner (providers table)? → allow everything.
//  2. Does the user hold a role assignment granting resource:action for this
//     business+location? → allow.
//  3. Neither → ErrAccessDenied.
func (s *Service) CanAccess(ctx context.Context, req AccessRequest) error {
	isOwner, err := s.owner.IsBusinessOwner(ctx, req.UserID, req.BusinessID)
	if err != nil {
		return err
	}
	if isOwner {
		return nil
	}

	perms, err := s.repo.GetUserPermissions(ctx, req.UserID, req.BusinessID, req.LocationID)
	if err != nil {
		return err
	}

	for _, p := range perms {
		if p.Resource == req.Resource && p.Action == req.Action {
			return nil
		}
	}

	return ErrAccessDenied
}
