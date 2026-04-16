package staff

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/google/uuid"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/rbac"
	"github.com/BohdanRohalskyi/bookit/api/internal/mail"
)

// Service holds the business logic for staff management and user memberships.
type Service struct {
	repo      *Repository
	rbacRepo  *rbac.PgRepository
	mailer    mail.Provider
	templates *mail.Templates
	bizURL    string
}

func NewService(
	repo *Repository,
	rbacRepo *rbac.PgRepository,
	mailer mail.Provider,
	templates *mail.Templates,
	bizURL string,
) *Service {
	return &Service{
		repo:      repo,
		rbacRepo:  rbacRepo,
		mailer:    mailer,
		templates: templates,
		bizURL:    bizURL,
	}
}

// GetMemberships returns all businesses the user owns and all businesses where
// they have a role assignment. Used by the frontend space picker.
func (s *Service) GetMemberships(ctx context.Context, userID uuid.UUID) (MembershipsResponse, error) {
	owned, err := s.repo.GetOwnedBusinesses(ctx, userID)
	if err != nil {
		return MembershipsResponse{}, fmt.Errorf("get owned businesses: %w", err)
	}

	rbacMemberships, err := s.rbacRepo.GetUserMemberships(ctx, userID)
	if err != nil {
		return MembershipsResponse{}, fmt.Errorf("get rbac memberships: %w", err)
	}

	memberships := make([]Membership, 0, len(rbacMemberships))
	for _, m := range rbacMemberships {
		memberships = append(memberships, Membership{
			BusinessID:   m.BusinessID,
			BusinessName: m.BusinessName,
			Category:     m.Category,
			IsActive:     m.IsActive,
			Role:         m.Role,
			LocationIDs:  m.LocationIDs,
		})
	}

	return MembershipsResponse{
		Owned:       owned,
		Memberships: memberships,
	}, nil
}

// ListMembers returns all active members and pending invites for a business.
func (s *Service) ListMembers(ctx context.Context, businessID uuid.UUID) ([]Member, error) {
	return s.repo.ListMembers(ctx, businessID)
}

// InviteMemberInput is the service-layer input for InviteMember.
type InviteMemberInput struct {
	Email      string
	RoleSlug   string // "administrator" | "staff"
	BusinessID uuid.UUID
	LocationID *uuid.UUID
	InvitedBy  uuid.UUID // userID of the inviter
}

// InviteMember sends an invite email. If the email already belongs to a
// registered user, the role assignment is created immediately and a notification
// email is sent. Otherwise an invite record is created and an invite email is sent.
func (s *Service) InviteMember(ctx context.Context, req InviteMemberInput) error {
	roleID, err := s.rbacRepo.GetRoleBySlug(ctx, req.RoleSlug)
	if err != nil {
		return fmt.Errorf("unknown role: %w", err)
	}

	businessName, err := s.repo.GetBusinessName(ctx, req.BusinessID)
	if err != nil {
		return fmt.Errorf("get business name: %w", err)
	}

	// Check if the user already exists by querying invites repository.
	// We look up the user directly via the DB — staff.Repository can run a
	// lightweight SELECT to check existence.
	existingUserID, err := s.repo.FindUserIDByEmail(ctx, req.Email)
	if err == nil {
		// User already registered — assign role immediately
		assignErr := s.rbacRepo.AssignRole(ctx, rbac.UserRoleAssignment{
			UserID:     existingUserID,
			RoleID:     roleID,
			BusinessID: req.BusinessID,
			LocationID: req.LocationID,
			AssignedBy: &req.InvitedBy,
		})
		if assignErr != nil && assignErr != rbac.ErrAssignmentExists {
			return fmt.Errorf("assign role: %w", assignErr)
		}
		// Send notification (best-effort)
		msg := s.templates.MemberAdded(req.Email, businessName, req.RoleSlug, s.bizURL)
		_ = s.mailer.Send(ctx, msg) //nolint:errcheck
		return nil
	}

	// User not found — create invite
	token, err := generateToken()
	if err != nil {
		return fmt.Errorf("generate token: %w", err)
	}

	tokenHash := hashToken(token)
	_, err = s.repo.CreateInvite(ctx, InviteCreate{
		Email:      req.Email,
		RoleID:     roleID,
		BusinessID: req.BusinessID,
		LocationID: req.LocationID,
		InvitedBy:  req.InvitedBy,
		TokenHash:  tokenHash,
		ExpiresAt:  InviteExpiresAt(),
	})
	if err != nil {
		return fmt.Errorf("create invite: %w", err)
	}

	msg := s.templates.StaffInvite(req.Email, businessName, req.RoleSlug, token, s.bizURL)
	_ = s.mailer.Send(ctx, msg) //nolint:errcheck
	return nil
}

// PreviewInvite returns invite details for the acceptance landing page.
func (s *Service) PreviewInvite(ctx context.Context, token string) (Invite, error) {
	inv, err := s.repo.GetInviteByToken(ctx, token)
	if err != nil {
		return Invite{}, err
	}
	if inv.AcceptedAt != nil {
		return Invite{}, ErrInviteAlreadyUsed
	}
	return inv, nil
}

// AcceptInvite accepts an invite for the authenticated user. It atomically
// marks the invite accepted and creates the role assignment.
func (s *Service) AcceptInvite(ctx context.Context, token string, userID uuid.UUID) error {
	inv, err := s.repo.GetInviteByToken(ctx, token)
	if err != nil {
		return err
	}
	if inv.AcceptedAt != nil {
		return ErrInviteAlreadyUsed
	}
	return s.repo.txAcceptInvite(ctx, inv, userID)
}

// RemoveMember removes an active role assignment from a business.
func (s *Service) RemoveMember(ctx context.Context, membershipID, businessID uuid.UUID) error {
	return s.repo.RemoveMember(ctx, membershipID, businessID)
}

// CancelInvite cancels a pending invite.
func (s *Service) CancelInvite(ctx context.Context, inviteID, businessID uuid.UUID) error {
	return s.repo.CancelInvite(ctx, inviteID, businessID)
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
