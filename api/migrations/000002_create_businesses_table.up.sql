CREATE TABLE businesses (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    provider_id BIGINT       NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(20)  NOT NULL CHECK (category IN ('beauty', 'sport', 'pet_care')),
    description TEXT,
    logo_url    TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_businesses_provider_id ON businesses(provider_id);
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
