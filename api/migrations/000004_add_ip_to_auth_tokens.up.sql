-- Add ip_address column for IP binding (used by app_switch tokens)
ALTER TABLE auth_tokens ADD COLUMN ip_address VARCHAR(45);
