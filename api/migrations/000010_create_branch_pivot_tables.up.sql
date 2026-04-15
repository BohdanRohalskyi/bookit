-- Equipment available at a specific branch (quantity)
CREATE TABLE branch_equipment (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity     SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    UNIQUE (branch_id, equipment_id)
);
CREATE INDEX idx_branch_equipment_branch_id ON branch_equipment(branch_id);

-- Staff roles staffed at a specific branch (quantity)
CREATE TABLE branch_staff_roles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    staff_role_id UUID NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
    quantity      SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    UNIQUE (branch_id, staff_role_id)
);
CREATE INDEX idx_branch_staff_roles_branch_id ON branch_staff_roles(branch_id);

-- Services offered at a specific branch
CREATE TABLE branch_services (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (branch_id, service_id)
);
CREATE INDEX idx_branch_services_branch_id ON branch_services(branch_id);
