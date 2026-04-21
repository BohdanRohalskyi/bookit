CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TABLE users (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid           UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255),
    name           VARCHAR(255) NOT NULL,
    phone          VARCHAR(50),
    email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE providers (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid       UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    user_id    BIGINT      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(20) NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_providers_user_id ON providers(user_id);

CREATE TABLE refresh_tokens (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid       UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);

CREATE TABLE auth_tokens (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid       UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    token_type VARCHAR(20) NOT NULL,
    ip_address VARCHAR(45),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auth_tokens_hash_type ON auth_tokens(token_hash, token_type) WHERE used_at IS NULL;
CREATE INDEX idx_auth_tokens_user_id   ON auth_tokens(user_id);
