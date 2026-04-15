CREATE TABLE branches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    address     VARCHAR(200) NOT NULL,
    city        VARCHAR(100) NOT NULL,
    country     VARCHAR(100) NOT NULL DEFAULT 'Lithuania',
    phone       VARCHAR(50),
    email       VARCHAR(255),
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    timezone    VARCHAR(100) NOT NULL DEFAULT 'Europe/Vilnius',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branches_business_id ON branches(business_id);
