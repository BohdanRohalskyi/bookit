-- Link each job title to its RBAC role.
-- is_system = true protects auto-seeded titles (e.g. "Administrator") from deletion.
ALTER TABLE staff_roles
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN role_id   BIGINT  NOT NULL REFERENCES roles(id) ON DELETE RESTRICT;

-- Tracks which job titles a user holds; populated when an invite is accepted.
CREATE TABLE user_staff_role_assignments (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid          UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id       BIGINT      NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  staff_role_id BIGINT      NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
  business_id   BIGINT      NOT NULL REFERENCES businesses(id)  ON DELETE CASCADE,
  assigned_by   BIGINT      REFERENCES users(id)                ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_staff_role_assignments_unique UNIQUE (user_id, staff_role_id, business_id)
);
CREATE INDEX idx_usra_user_business ON user_staff_role_assignments(user_id, business_id);
CREATE INDEX idx_usra_staff_role    ON user_staff_role_assignments(staff_role_id);

-- Carries the owner's job-title selections through the invite flow.
ALTER TABLE invites ADD COLUMN staff_role_ids BIGINT[] NOT NULL DEFAULT '{}';
