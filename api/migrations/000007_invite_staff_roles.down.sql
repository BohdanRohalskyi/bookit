ALTER TABLE invites DROP COLUMN IF EXISTS staff_role_ids;
DROP TABLE IF EXISTS user_staff_role_assignments;
ALTER TABLE staff_roles DROP COLUMN IF EXISTS role_id;
ALTER TABLE staff_roles DROP COLUMN IF EXISTS is_system;
