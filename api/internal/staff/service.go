package staff

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

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
	auth      AuthProvider
}

func NewService(
	repo *Repository,
	rbacRepo *rbac.PgRepository,
	mailer mail.Provider,
	templates *mail.Templates,
	bizURL string,
	auth AuthProvider,
) *Service {
	return &Service{
		repo:      repo,
		rbacRepo:  rbacRepo,
		mailer:    mailer,
		templates: templates,
		bizURL:    bizURL,
		auth:      auth,
	}
}

// GetMemberships returns all businesses the user owns and all businesses where
// they have a role assignment. Used by the frontend space picker.
func (s *Service) GetMemberships(ctx context.Context, userID int64) (MembershipsResponse, error) {
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
func (s *Service) ListMembers(ctx context.Context, businessID int64) ([]Member, error) {
	return s.repo.ListMembers(ctx, businessID)
}

// RemoveMember deletes an active role assignment scoped to a business.
func (s *Service) RemoveMember(ctx context.Context, memberID, businessID int64) error {
	return s.repo.RemoveMember(ctx, memberID, businessID)
}

// CancelInvite cancels a pending invite.
func (s *Service) CancelInvite(ctx context.Context, inviteID, businessID int64) error {
	return s.repo.CancelInvite(ctx, inviteID, businessID)
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
		FullName:   req.FullName,
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

// PreviewInvite returns invite details for the acceptance landing page,
// including whether the invitee's email is already registered.
func (s *Service) PreviewInvite(ctx context.Context, token string) (Invite, error) {
	inv, err := s.repo.GetInviteByToken(ctx, token)
	if err != nil {
		return Invite{}, err
	}
	if inv.AcceptedAt != nil {
		return Invite{}, ErrInviteAlreadyUsed
	}

	_, err = s.repo.FindUserIDByEmail(ctx, inv.Email)
	inv.UserExists = (err == nil)

	return inv, nil
}

// AcceptInvite accepts an invite for the authenticated user. It atomically
// marks the invite accepted, creates the role assignment, verifies the user's
// email, and upserts a business_member_profiles row.
func (s *Service) AcceptInvite(ctx context.Context, token string, userID int64) error {
	inv, err := s.repo.GetInviteByToken(ctx, token)
	if err != nil {
		return err
	}
	if inv.AcceptedAt != nil {
		return ErrInviteAlreadyUsed
	}
	return s.repo.txAcceptInvite(ctx, inv, userID)
}

// RegisterAndAcceptInvite registers a new user and accepts their invite in one
// step. Returns tokens so the frontend can log the user in immediately.
// fullNameOverride, if non-empty, replaces the name stored on the invite.
func (s *Service) RegisterAndAcceptInvite(ctx context.Context, token, password, fullNameOverride string) (*RegisterResult, error) {
	inv, err := s.repo.GetInviteByToken(ctx, token)
	if err != nil {
		return nil, err
	}
	if inv.AcceptedAt != nil {
		return nil, ErrInviteAlreadyUsed
	}

	// Resolve the name to use for the new profile
	fullName := fullNameOverride
	if fullName == "" && inv.FullName != nil {
		fullName = *inv.FullName
	}

	// Create a verified user account (no verification email sent)
	userID, err := s.auth.CreateVerifiedUser(ctx, inv.Email, password, fullName)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	// Accept invite + create role assignment + create member profile
	if err := s.repo.txRegisterAndAcceptInvite(ctx, inv, userID, fullName); err != nil {
		return nil, fmt.Errorf("accept invite: %w", err)
	}

	// Issue tokens
	tokens, err := s.auth.IssueTokens(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("issue tokens: %w", err)
	}

	return &RegisterResult{
		UserID: userID,
		Email:  inv.Email,
		Name:   fullName,
		Tokens: *tokens,
	}, nil
}

// GetMyProfile returns the authenticated user's business-scoped profile.
func (s *Service) GetMyProfile(ctx context.Context, userID, businessID int64) (MemberProfile, error) {
	return s.repo.GetMemberProfile(ctx, userID, businessID)
}

// UpdateMyProfile upserts the authenticated user's name in a business profile.
func (s *Service) UpdateMyProfile(ctx context.Context, userID, businessID int64, fullName string) (MemberProfile, error) {
	isMember, err := s.repo.IsMemberOfBusiness(ctx, userID, businessID)
	if err != nil {
		return MemberProfile{}, err
	}
	if !isMember {
		return MemberProfile{}, ErrMemberNotFound
	}
	return s.repo.UpsertMemberProfile(ctx, userID, businessID, fullName)
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
