-- ─── roles ───────────────────────────────────────────────────────────────────
-- business_id IS NULL  → system-defined role (shared across all businesses)
-- business_id NOT NULL → custom role created by that business owner (future role builder)

CREATE TABLE roles (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID         REFERENCES businesses(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL,
    is_system   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT roles_slug_scope_unique UNIQUE NULLS NOT DISTINCT (business_id, slug)
);

CREATE INDEX idx_roles_business_id ON roles(business_id);
CREATE INDEX idx_roles_slug        ON roles(slug);

-- ─── role_permissions ─────────────────────────────────────────────────────────

CREATE TABLE role_permissions (
    id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id  UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    resource VARCHAR(50) NOT NULL,
    action   VARCHAR(50) NOT NULL,
    CONSTRAINT role_permissions_unique UNIQUE (role_id, resource, action)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);

-- ─── user_role_assignments ────────────────────────────────────────────────────
-- location_id IS NULL → assignment covers all locations within the business
-- location_id NOT NULL → assignment is scoped to that specific location

CREATE TABLE user_role_assignments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    role_id     UUID        NOT NULL REFERENCES roles(id)      ON DELETE CASCADE,
    business_id UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    location_id UUID        REFERENCES locations(id)           ON DELETE CASCADE,
    assigned_by UUID        REFERENCES users(id)               ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_role_assignments_unique
        UNIQUE NULLS NOT DISTINCT (user_id, role_id, business_id, location_id)
);

CREATE INDEX idx_ura_user_business ON user_role_assignments(user_id, business_id);
CREATE INDEX idx_ura_location      ON user_role_assignments(location_id)
    WHERE location_id IS NOT NULL;

-- ─── Seed: system roles (fixed UUIDs for idempotency across environments) ────

INSERT INTO roles (id, business_id, name, slug, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', NULL, 'Administrator', 'administrator', true),
    ('00000000-0000-0000-0000-000000000002', NULL, 'Staff',         'staff',         true);

-- ─── Seed: Administrator permissions ─────────────────────────────────────────

INSERT INTO role_permissions (role_id, resource, action) VALUES
    ('00000000-0000-0000-0000-000000000001', 'location',  'read'),
    ('00000000-0000-0000-0000-000000000001', 'location',  'write'),
    ('00000000-0000-0000-0000-000000000001', 'staff',     'read'),
    ('00000000-0000-0000-0000-000000000001', 'staff',     'write'),
    ('00000000-0000-0000-0000-000000000001', 'services',  'read'),
    ('00000000-0000-0000-0000-000000000001', 'services',  'write'),
    ('00000000-0000-0000-0000-000000000001', 'equipment', 'read'),
    ('00000000-0000-0000-0000-000000000001', 'equipment', 'write'),
    ('00000000-0000-0000-0000-000000000001', 'bookings',  'read'),
    ('00000000-0000-0000-0000-000000000001', 'bookings',  'read_own'),
    ('00000000-0000-0000-0000-000000000001', 'bookings',  'write');

-- ─── Seed: Staff permissions ──────────────────────────────────────────────────

INSERT INTO role_permissions (role_id, resource, action) VALUES
    ('00000000-0000-0000-0000-000000000002', 'location', 'read'),
    ('00000000-0000-0000-0000-000000000002', 'services', 'read'),
    ('00000000-0000-0000-0000-000000000002', 'bookings', 'read_own');
