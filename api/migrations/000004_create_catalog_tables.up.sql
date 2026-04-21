CREATE TABLE equipment (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    business_id BIGINT      NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_equipment_business_id ON equipment(business_id);

CREATE TABLE staff_roles (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    business_id BIGINT      NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    job_title   VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_staff_roles_business_id ON staff_roles(business_id);

CREATE TABLE services (
    id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid             UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    business_id      BIGINT        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name             VARCHAR(100)  NOT NULL,
    description      TEXT,
    duration_minutes INTEGER       NOT NULL CHECK (duration_minutes > 0),
    price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    currency         CHAR(3)       NOT NULL DEFAULT 'EUR',
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_services_business_id ON services(business_id);
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE service_equipment_requirements (
    id              BIGINT   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID     NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    service_id      BIGINT   NOT NULL REFERENCES services(id)   ON DELETE CASCADE,
    equipment_id    BIGINT   NOT NULL REFERENCES equipment(id)  ON DELETE CASCADE,
    quantity_needed SMALLINT NOT NULL DEFAULT 1 CHECK (quantity_needed >= 1),
    UNIQUE (service_id, equipment_id)
);

CREATE TABLE service_staff_requirements (
    id              BIGINT   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID     NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    service_id      BIGINT   NOT NULL REFERENCES services(id)    ON DELETE CASCADE,
    staff_role_id   BIGINT   NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
    quantity_needed SMALLINT NOT NULL DEFAULT 1 CHECK (quantity_needed >= 1),
    UNIQUE (service_id, staff_role_id)
);

CREATE TABLE location_equipment (
    id           BIGINT   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid         UUID     NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    location_id  BIGINT   NOT NULL REFERENCES locations(id)  ON DELETE CASCADE,
    equipment_id BIGINT   NOT NULL REFERENCES equipment(id)  ON DELETE CASCADE,
    quantity     SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    UNIQUE (location_id, equipment_id)
);
CREATE INDEX idx_location_equipment_location_id ON location_equipment(location_id);

CREATE TABLE location_staff_roles (
    id            BIGINT   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid          UUID     NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    location_id   BIGINT   NOT NULL REFERENCES locations(id)   ON DELETE CASCADE,
    staff_role_id BIGINT   NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
    quantity      SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    UNIQUE (location_id, staff_role_id)
);
CREATE INDEX idx_location_staff_roles_location_id ON location_staff_roles(location_id);

CREATE TABLE location_services (
    id          BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID    NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    location_id BIGINT  NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    service_id  BIGINT  NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (location_id, service_id)
);
CREATE INDEX idx_location_services_location_id ON location_services(location_id);
