package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// SendGridProvider sends emails via SendGrid API
type SendGridProvider struct {
	apiKey string
	from   string
}

func NewSendGridProvider(apiKey, from string) *SendGridProvider {
	return &SendGridProvider{
		apiKey: apiKey,
		from:   from,
	}
}

type sendGridRequest struct {
	Personalizations []sendGridPersonalization `json:"personalizations"`
	From             sendGridEmail             `json:"from"`
	Subject          string                    `json:"subject"`
	Content          []sendGridContent         `json:"content"`
}

type sendGridPersonalization struct {
	To []sendGridEmail `json:"to"`
}

type sendGridEmail struct {
	Email string `json:"email"`
}

type sendGridContent struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

func (p *SendGridProvider) Send(ctx context.Context, msg Message) error {
	payload := sendGridRequest{
		Personalizations: []sendGridPersonalization{
			{To: []sendGridEmail{{Email: msg.To}}},
		},
		From:    sendGridEmail{Email: p.from},
		Subject: msg.Subject,
		Content: []sendGridContent{
			{Type: "text/html", Value: msg.HTML},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.sendgrid.com/v3/mail/send", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("sendgrid error: status %d", resp.StatusCode)
	}

	return nil
}
