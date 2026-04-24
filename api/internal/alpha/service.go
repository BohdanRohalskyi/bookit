package alpha

import (
	"context"
	"log/slog"

	"github.com/BohdanRohalskyi/bookit/api/internal/mail"
)

const notifyEmail = "bohdan.rohalskyi@paysera.net"

type repository interface {
	Create(ctx context.Context, req AccessRequestCreate) (AccessRequest, error)
}

type Service struct {
	repo      repository
	mailer    mail.Provider
	templates *mail.Templates
}

func NewService(repo repository, mailer mail.Provider, templates *mail.Templates) *Service {
	return &Service{repo: repo, mailer: mailer, templates: templates}
}

func (s *Service) Submit(ctx context.Context, req AccessRequestCreate) error {
	if _, err := s.repo.Create(ctx, req); err != nil {
		return err
	}
	msg := s.templates.AlphaAccessRequest(notifyEmail, req.CompanyName, req.Email, req.Description)
	if err := s.mailer.Send(ctx, msg); err != nil {
		slog.Error("alpha access notification email failed", "error", err, "company", req.CompanyName)
	}
	return nil
}
