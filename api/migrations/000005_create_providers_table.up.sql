CREATE TABLE providers (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT providers_user_id_unique UNIQUE (user_id),
    CONSTRAINT providers_status_check CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE INDEX idx_providers_user_id ON providers(user_id);
