-- Create auth_tokens table for email verification and password reset tokens
CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    token_type VARCHAR(20) NOT NULL, -- 'email_verification' or 'password_reset'
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for token lookup
CREATE INDEX idx_auth_tokens_hash_type ON auth_tokens (token_hash, token_type) WHERE used_at IS NULL;

-- Index for user's tokens
CREATE INDEX idx_auth_tokens_user_id ON auth_tokens (user_id);
