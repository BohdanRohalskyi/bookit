CREATE TABLE business_member_profiles (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    business_id UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    full_name   VARCHAR(255) NOT NULL,
    photo_url   VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, business_id)
);

CREATE INDEX idx_bmp_user     ON business_member_profiles(user_id);
CREATE INDEX idx_bmp_business ON business_member_profiles(business_id);
