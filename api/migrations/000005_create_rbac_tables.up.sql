CREATE TABLE roles (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    business_id BIGINT      REFERENCES businesses(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL,
    is_system   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT roles_slug_scope_unique UNIQUE NULLS NOT DISTINCT (business_id, slug)
);
CREATE INDEX idx_roles_business_id ON roles(business_id);
CREATE INDEX idx_roles_slug        ON roles(slug);

CREATE TABLE role_permissions (
    id       BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid     UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    role_id  BIGINT      NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    resource VARCHAR(50) NOT NULL,
    action   VARCHAR(50) NOT NULL,
    UNIQUE (role_id, resource, action)
);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);

CREATE TABLE user_role_assignments (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    user_id     BIGINT      NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    role_id     BIGINT      NOT NULL REFERENCES roles(id)      ON DELETE CASCADE,
    business_id BIGINT      NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    location_id BIGINT      REFERENCES locations(id)           ON DELETE CASCADE,
    assigned_by BIGINT      REFERENCES users(id)               ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_role_assignments_unique
        UNIQUE NULLS NOT DISTINCT (user_id, role_id, business_id, location_id)
);
CREATE INDEX idx_ura_user_business ON user_role_assignments(user_id, business_id);
CREATE INDEX idx_ura_location      ON user_role_assignments(location_id)
    WHERE location_id IS NOT NULL;

-- ─── Seed system roles ────────────────────────────────────────────────────────

INSERT INTO roles (name, slug, is_system) VALUES
    ('Administrator', 'administrator', true),
    ('Staff',         'staff',         true);

-- ─── Seed role permissions ────────────────────────────────────────────────────

INSERT INTO role_permissions (role_id, resource, action)
SELECT r.id, v.resource, v.action
FROM roles r
JOIN (VALUES
    ('location',  'read'),
    ('location',  'write'),
    ('staff',     'read'),
    ('staff',     'write'),
    ('services',  'read'),
    ('services',  'write'),
    ('equipment', 'read'),
    ('equipment', 'write'),
    ('bookings',  'read'),
    ('bookings',  'read_own'),
    ('bookings',  'write')
) AS v(resource, action) ON true
WHERE r.slug = 'administrator' AND r.is_system = true;

INSERT INTO role_permissions (role_id, resource, action)
SELECT r.id, v.resource, v.action
FROM roles r
JOIN (VALUES
    ('location', 'read'),
    ('services', 'read'),
    ('bookings', 'read_own')
) AS v(resource, action) ON true
WHERE r.slug = 'staff' AND r.is_system = true;
