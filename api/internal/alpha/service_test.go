package alpha

import (
	"context"
	"errors"
	"testing"

	"github.com/BohdanRohalskyi/bookit/api/internal/mail"
	"github.com/stretchr/testify/assert"
)

type mockRepository struct {
	create func(ctx context.Context, req AccessRequestCreate) (AccessRequest, error)
}

func (m *mockRepository) Create(ctx context.Context, req AccessRequestCreate) (AccessRequest, error) {
	if m.create != nil {
		return m.create(ctx, req)
	}
	return AccessRequest{}, nil
}

type mockMailProvider struct {
	sent []mail.Message
	err  error
}

func (m *mockMailProvider) Send(_ context.Context, msg mail.Message) error {
	m.sent = append(m.sent, msg)
	return m.err
}

func TestService_Submit(t *testing.T) {
	t.Parallel()

	req := AccessRequestCreate{
		Email:       "test@example.com",
		CompanyName: "Acme",
		Description: "Want access",
	}

	t.Run("saves to repo and sends email", func(t *testing.T) {
		t.Parallel()
		mailer := &mockMailProvider{}
		repo := &mockRepository{}
		svc := NewService(repo, mailer, mail.NewTemplates("http://localhost"))

		err := svc.Submit(context.Background(), req)
		assert.NoError(t, err)
		assert.Len(t, mailer.sent, 1)
		assert.Equal(t, notifyEmail, mailer.sent[0].To)
		assert.Contains(t, mailer.sent[0].Subject, "Acme")
	})

	t.Run("returns error when repo fails", func(t *testing.T) {
		t.Parallel()
		mailer := &mockMailProvider{}
		repo := &mockRepository{
			create: func(_ context.Context, _ AccessRequestCreate) (AccessRequest, error) {
				return AccessRequest{}, errors.New("db error")
			},
		}
		svc := NewService(repo, mailer, mail.NewTemplates("http://localhost"))

		err := svc.Submit(context.Background(), req)
		assert.Error(t, err)
		assert.Empty(t, mailer.sent) // email not sent if db fails
	})

	t.Run("email send error is ignored", func(t *testing.T) {
		t.Parallel()
		mailer := &mockMailProvider{err: errors.New("smtp down")}
		repo := &mockRepository{}
		svc := NewService(repo, mailer, mail.NewTemplates("http://localhost"))

		err := svc.Submit(context.Background(), req)
		assert.NoError(t, err) // mail failure is logged, not returned
	})
}
