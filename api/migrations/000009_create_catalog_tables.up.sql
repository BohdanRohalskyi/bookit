-- Equipment types (business-level catalog)
CREATE TABLE equipment (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_equipment_business_id ON equipment(business_id);

-- Staff role types (business-level catalog — not individual staff members)
CREATE TABLE staff_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    job_title   VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_staff_roles_business_id ON staff_roles(business_id);

-- Services (business-level catalog)
CREATE TABLE services (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    description      TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    currency         CHAR(3) NOT NULL DEFAULT 'EUR',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_services_business_id ON services(business_id);

-- Service resource requirements
CREATE TABLE service_equipment_requirements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    equipment_id    UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity_needed SMALLINT NOT NULL DEFAULT 1 CHECK (quantity_needed >= 1),
    UNIQUE (service_id, equipment_id)
);

CREATE TABLE service_staff_requirements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    staff_role_id   UUID NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
    quantity_needed SMALLINT NOT NULL DEFAULT 1 CHECK (quantity_needed >= 1),
    UNIQUE (service_id, staff_role_id)
);
