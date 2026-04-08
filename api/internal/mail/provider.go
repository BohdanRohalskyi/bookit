package mail

import "context"

// Message represents an email to be sent
type Message struct {
	To      string
	Subject string
	HTML    string
	Text    string // Plain text fallback
}

// Provider is the interface for sending emails
type Provider interface {
	Send(ctx context.Context, msg Message) error
}
