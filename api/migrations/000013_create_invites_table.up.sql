CREATE TABLE invites (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL,
    role_id     UUID         NOT NULL REFERENCES roles(id)      ON DELETE CASCADE,
    business_id UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    location_id UUID         REFERENCES locations(id)           ON DELETE CASCADE,
    invited_by  UUID         NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    token_hash  VARCHAR(64)  NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_invites_token_hash ON invites(token_hash) WHERE accepted_at IS NULL;
CREATE INDEX idx_invites_business          ON invites(business_id);
CREATE INDEX idx_invites_email             ON invites(email);
