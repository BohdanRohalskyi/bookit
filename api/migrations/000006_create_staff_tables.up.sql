CREATE TABLE invites (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL,
    full_name   VARCHAR(255),
    role_id     BIGINT      NOT NULL REFERENCES roles(id)      ON DELETE CASCADE,
    business_id BIGINT      NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    location_id BIGINT      REFERENCES locations(id)           ON DELETE CASCADE,
    invited_by  BIGINT      NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_invites_token_hash ON invites(token_hash) WHERE accepted_at IS NULL;
CREATE INDEX idx_invites_business          ON invites(business_id);
CREATE INDEX idx_invites_email             ON invites(email);

CREATE TABLE business_member_profiles (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    user_id     BIGINT      NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    business_id BIGINT      NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    full_name   VARCHAR(255) NOT NULL,
    photo_url   VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, business_id)
);
CREATE INDEX idx_bmp_user     ON business_member_profiles(user_id);
CREATE INDEX idx_bmp_business ON business_member_profiles(business_id);
CREATE TRIGGER update_bmp_updated_at BEFORE UPDATE ON business_member_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
