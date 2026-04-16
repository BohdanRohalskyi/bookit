package mail

import "fmt"

// Templates creates email messages with the given base URL
type Templates struct {
	baseURL string
}

func NewTemplates(baseURL string) *Templates {
	return &Templates{baseURL: baseURL}
}

// EmailVerification creates a verification email
func (t *Templates) EmailVerification(to, token string) Message {
	link := fmt.Sprintf("%s/verify-email?token=%s", t.baseURL, token)

	return Message{
		To:      to,
		Subject: "Verify your Bookit email",
		HTML: fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 6px; }
    .footer { margin-top: 40px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Verify your email</h1>
    <p>Thanks for signing up for Bookit! Please verify your email address by clicking the button below:</p>
    <p><a href="%s" class="button">Verify Email</a></p>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="%s">%s</a></p>
    <p>This link expires in 24 hours.</p>
    <div class="footer">
      <p>If you didn't create an account, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
`, link, link, link),
		Text: fmt.Sprintf("Verify your Bookit email by visiting: %s\n\nThis link expires in 24 hours.", link),
	}
}

// StaffInvite creates an invite email for a new staff member.
func (t *Templates) StaffInvite(to, businessName, role, token, bizURL string) Message {
	link := fmt.Sprintf("%s/invites?token=%s", bizURL, token)

	return Message{
		To:      to,
		Subject: fmt.Sprintf("You've been invited to join %s on Bookit", businessName),
		HTML: fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #1069d1; color: #fff; text-decoration: none; border-radius: 6px; }
    .footer { margin-top: 40px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <p style="font-size:24px;font-weight:600;margin:0 0 16px">You've been invited</p>
    <p>You have been invited to join <strong>%s</strong> as <strong>%s</strong> on Bookit.</p>
    <p>Click the button below to accept the invitation and get started:</p>
    <p><a href="%s" class="button">Accept Invitation</a></p>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="%s">%s</a></p>
    <p>This invitation expires in 7 days.</p>
    <div class="footer">
      <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
`, businessName, role, link, link, link),
		Text: fmt.Sprintf(
			"You've been invited to join %s as %s on Bookit.\n\nAccept your invitation: %s\n\nThis link expires in 7 days.",
			businessName, role, link,
		),
	}
}

// MemberAdded creates a notification email for an existing user added to a business.
func (t *Templates) MemberAdded(to, businessName, role, bizURL string) Message {
	return Message{
		To:      to,
		Subject: fmt.Sprintf("You've been added to %s on Bookit", businessName),
		HTML: fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #1069d1; color: #fff; text-decoration: none; border-radius: 6px; }
    .footer { margin-top: 40px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <p style="font-size:24px;font-weight:600;margin:0 0 16px">You've been added to a team</p>
    <p>You have been added to <strong>%s</strong> as <strong>%s</strong> on Bookit.</p>
    <p><a href="%s" class="button">Open Bookit Business</a></p>
    <div class="footer">
      <p>If you weren't expecting this, please contact your business administrator.</p>
    </div>
  </div>
</body>
</html>
`, businessName, role, bizURL),
		Text: fmt.Sprintf(
			"You've been added to %s as %s on Bookit. Open the app: %s",
			businessName, role, bizURL,
		),
	}
}

// PasswordReset creates a password reset email
func (t *Templates) PasswordReset(to, token string) Message {
	link := fmt.Sprintf("%s/reset-password?token=%s", t.baseURL, token)

	return Message{
		To:      to,
		Subject: "Reset your Bookit password",
		HTML: fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 6px; }
    .footer { margin-top: 40px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reset your password</h1>
    <p>We received a request to reset your Bookit password. Click the button below to choose a new password:</p>
    <p><a href="%s" class="button">Reset Password</a></p>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="%s">%s</a></p>
    <p>This link expires in 1 hour.</p>
    <div class="footer">
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
`, link, link, link),
		Text: fmt.Sprintf("Reset your Bookit password by visiting: %s\n\nThis link expires in 1 hour.", link),
	}
}
