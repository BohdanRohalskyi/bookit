package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type ResendProvider struct {
	apiKey string
	from   string
}

func NewResendProvider(apiKey, from string) *ResendProvider {
	return &ResendProvider{apiKey: apiKey, from: from}
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

func (p *ResendProvider) Send(ctx context.Context, msg Message) error {
	payload := resendRequest{
		From:    p.from,
		To:      []string{msg.To},
		Subject: msg.Subject,
		HTML:    msg.HTML,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }() //nolint:errcheck

	if resp.StatusCode >= 400 {
		return fmt.Errorf("resend error: status %d", resp.StatusCode)
	}

	return nil
}
