package mail

import (
	"context"
	"fmt"
	"net/smtp"
)

// SMTPProvider sends emails via SMTP (for local dev with Mailpit)
type SMTPProvider struct {
	host     string
	port     int
	from     string
	username string // optional, empty for no auth
	password string // optional, empty for no auth
}

type SMTPConfig struct {
	Host     string
	Port     int
	From     string
	Username string
	Password string
}

func NewSMTPProvider(cfg SMTPConfig) *SMTPProvider {
	return &SMTPProvider{
		host:     cfg.Host,
		port:     cfg.Port,
		from:     cfg.From,
		username: cfg.Username,
		password: cfg.Password,
	}
}

func (p *SMTPProvider) Send(ctx context.Context, msg Message) error {
	addr := fmt.Sprintf("%s:%d", p.host, p.port)

	headers := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n",
		p.from, msg.To, msg.Subject)

	body := headers + msg.HTML

	var auth smtp.Auth
	if p.username != "" {
		auth = smtp.PlainAuth("", p.username, p.password, p.host)
	}

	return smtp.SendMail(addr, auth, p.from, []string{msg.To}, []byte(body))
}
