-- 000016_integer_primary_keys.up.sql
-- Replaces UUID primary keys with BIGSERIAL integer PKs.
-- Each table gets:
--   id     BIGSERIAL PRIMARY KEY  (internal, used for all JOINs/FKs)
--   uuid   UUID NOT NULL UNIQUE   (public, returned in API responses)
--
-- Processing order: parents before children so FK renames can reference
-- already-migrated parent new_id values.

BEGIN;

-- ─── 1. users ──────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN uuid UUID;
UPDATE users SET uuid = id;
ALTER TABLE users ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE users ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE users ADD CONSTRAINT users_uuid_unique UNIQUE (uuid);

ALTER TABLE users ADD COLUMN new_id BIGSERIAL;

-- Children: providers.user_id, refresh_tokens.user_id, auth_tokens.user_id,
--           user_role_assignments.user_id + assigned_by,
--           invites.invited_by, business_member_profiles.user_id

ALTER TABLE providers ADD COLUMN user_id_new BIGINT;
UPDATE providers SET user_id_new = u.new_id FROM users u WHERE u.uuid = providers.user_id::uuid;

ALTER TABLE refresh_tokens ADD COLUMN user_id_new BIGINT;
UPDATE refresh_tokens SET user_id_new = u.new_id FROM users u WHERE u.uuid = refresh_tokens.user_id::uuid;

ALTER TABLE auth_tokens ADD COLUMN user_id_new BIGINT;
UPDATE auth_tokens SET user_id_new = u.new_id FROM users u WHERE u.uuid = auth_tokens.user_id::uuid;

ALTER TABLE user_role_assignments ADD COLUMN user_id_new BIGINT;
UPDATE user_role_assignments SET user_id_new = u.new_id FROM users u WHERE u.uuid = user_role_assignments.user_id::uuid;

ALTER TABLE user_role_assignments ADD COLUMN assigned_by_new BIGINT;
UPDATE user_role_assignments SET assigned_by_new = u.new_id FROM users u WHERE u.uuid = user_role_assignments.assigned_by::uuid;

ALTER TABLE invites ADD COLUMN invited_by_new BIGINT;
UPDATE invites SET invited_by_new = u.new_id FROM users u WHERE u.uuid = invites.invited_by::uuid;

ALTER TABLE business_member_profiles ADD COLUMN user_id_new BIGINT;
UPDATE business_member_profiles SET user_id_new = u.new_id FROM users u WHERE u.uuid = business_member_profiles.user_id::uuid;

-- Drop FK constraints referencing users.id
ALTER TABLE providers DROP CONSTRAINT providers_user_id_unique;
ALTER TABLE providers DROP CONSTRAINT providers_user_id_fkey;
ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_user_id_fkey;
ALTER TABLE auth_tokens DROP CONSTRAINT auth_tokens_user_id_fkey;
ALTER TABLE user_role_assignments DROP CONSTRAINT user_role_assignments_user_id_fkey;
ALTER TABLE user_role_assignments DROP CONSTRAINT user_role_assignments_assigned_by_fkey;
ALTER TABLE invites DROP CONSTRAINT invites_invited_by_fkey;
ALTER TABLE business_member_profiles DROP CONSTRAINT business_member_profiles_user_id_fkey;

-- Drop users PK
ALTER TABLE users DROP CONSTRAINT users_pkey;

-- Rename new_id → id, set PK
ALTER TABLE users DROP COLUMN id;
ALTER TABLE users RENAME COLUMN new_id TO id;
ALTER TABLE users ADD PRIMARY KEY (id);

-- Fix children
ALTER TABLE providers DROP COLUMN user_id;
ALTER TABLE providers RENAME COLUMN user_id_new TO user_id;
ALTER TABLE providers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE providers ADD CONSTRAINT providers_user_id_unique UNIQUE (user_id);
ALTER TABLE providers ADD CONSTRAINT providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE refresh_tokens DROP COLUMN user_id;
ALTER TABLE refresh_tokens RENAME COLUMN user_id_new TO user_id;
ALTER TABLE refresh_tokens ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE auth_tokens DROP COLUMN user_id;
ALTER TABLE auth_tokens RENAME COLUMN user_id_new TO user_id;
ALTER TABLE auth_tokens ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_role_assignments DROP COLUMN user_id;
ALTER TABLE user_role_assignments RENAME COLUMN user_id_new TO user_id;
ALTER TABLE user_role_assignments ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_role_assignments ADD CONSTRAINT user_role_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_role_assignments DROP COLUMN assigned_by;
ALTER TABLE user_role_assignments RENAME COLUMN assigned_by_new TO assigned_by;
ALTER TABLE user_role_assignments ADD CONSTRAINT user_role_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE invites DROP COLUMN invited_by;
ALTER TABLE invites RENAME COLUMN invited_by_new TO invited_by;
ALTER TABLE invites ALTER COLUMN invited_by SET NOT NULL;
ALTER TABLE invites ADD CONSTRAINT invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE business_member_profiles DROP COLUMN user_id;
ALTER TABLE business_member_profiles RENAME COLUMN user_id_new TO user_id;
ALTER TABLE business_member_profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE business_member_profiles ADD CONSTRAINT business_member_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ─── 2. providers ──────────────────────────────────────────────────────────────

ALTER TABLE providers ADD COLUMN uuid UUID;
UPDATE providers SET uuid = id;
ALTER TABLE providers ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE providers ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE providers ADD CONSTRAINT providers_uuid_unique UNIQUE (uuid);

ALTER TABLE providers ADD COLUMN new_id BIGSERIAL;

-- Children: businesses.provider_id
ALTER TABLE businesses ADD COLUMN provider_id_new BIGINT;
UPDATE businesses SET provider_id_new = p.new_id FROM providers p WHERE p.uuid = businesses.provider_id::uuid;

-- Drop FK
ALTER TABLE businesses DROP CONSTRAINT businesses_provider_id_fkey;

-- Drop providers PK
ALTER TABLE providers DROP CONSTRAINT providers_pkey;

ALTER TABLE providers DROP COLUMN id;
ALTER TABLE providers RENAME COLUMN new_id TO id;
ALTER TABLE providers ADD PRIMARY KEY (id);

-- Fix children
ALTER TABLE businesses DROP COLUMN provider_id;
ALTER TABLE businesses RENAME COLUMN provider_id_new TO provider_id;
ALTER TABLE businesses ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE businesses ADD CONSTRAINT businesses_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

-- ─── 3. businesses ─────────────────────────────────────────────────────────────

ALTER TABLE businesses ADD COLUMN uuid UUID;
UPDATE businesses SET uuid = id;
ALTER TABLE businesses ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE businesses ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE businesses ADD CONSTRAINT businesses_uuid_unique UNIQUE (uuid);

ALTER TABLE businesses ADD COLUMN new_id BIGSERIAL;

-- Children: locations.business_id, equipment.business_id, staff_roles.business_id,
--           services.business_id, roles.business_id (nullable),
--           user_role_assignments.business_id, invites.business_id,
--           business_member_profiles.business_id

ALTER TABLE locations ADD COLUMN business_id_new BIGINT;
UPDATE locations SET business_id_new = b.new_id FROM businesses b WHERE b.uuid = locations.business_id::uuid;

ALTER TABLE equipment ADD COLUMN business_id_new BIGINT;
UPDATE equipment SET business_id_new = b.new_id FROM businesses b WHERE b.uuid = equipment.business_id::uuid;

ALTER TABLE staff_roles ADD COLUMN business_id_new BIGINT;
UPDATE staff_roles SET business_id_new = b.new_id FROM businesses b WHERE b.uuid = staff_roles.business_id::uuid;

ALTER TABLE services ADD COLUMN business_id_new BIGINT;
UPDATE services SET business_id_new = b.new_id FROM businesses b WHERE b.uuid = services.business_id::uuid;

ALTER TABLE roles ADD COLUMN business_id_new BIGINT;
UPDATE roles SET business_id_new = b.new_id FROM businesses b WHERE b.uuid = roles.business_id::uuid;
-- business_id is nullable in roles; NULL rows remain NULL

ALTER TABLE user_role_assignments ADD COLUMN business_id_new BIGINT;
UPDATE user_role_assignments SET business_id_new = b.new_id FROM businesses b WHERE b.uuid = user_role_assignments.business_id::uuid;

ALTER TABLE invites ADD COLUMN business_id_new BIGINT;
UPDATE invites SET business_id_new = b.new_id FROM businesses b WHERE b.uuid = invites.business_id::uuid;

ALTER TABLE business_member_profiles ADD COLUMN business_id_new BIGINT;
UPDATE business_member_profiles SET business_id_new = b.new_id FROM businesses b WHERE b.uuid = business_member_profiles.business_id::uuid;

-- Drop FK constraints referencing businesses.id
ALTER TABLE locations DROP CONSTRAINT locations_business_id_fkey;
ALTER TABLE equipment DROP CONSTRAINT equipment_business_id_fkey;
ALTER TABLE staff_roles DROP CONSTRAINT staff_roles_business_id_fkey;
ALTER TABLE services DROP CONSTRAINT services_business_id_fkey;
ALTER TABLE roles DROP CONSTRAINT roles_business_id_fkey;
ALTER TABLE user_role_assignments DROP CONSTRAINT user_role_assignments_business_id_fkey;
ALTER TABLE invites DROP CONSTRAINT invites_business_id_fkey;
ALTER TABLE business_member_profiles DROP CONSTRAINT business_member_profiles_business_id_fkey;

-- Drop businesses PK
ALTER TABLE businesses DROP CONSTRAINT businesses_pkey;

ALTER TABLE businesses DROP COLUMN id;
ALTER TABLE businesses RENAME COLUMN new_id TO id;
ALTER TABLE businesses ADD PRIMARY KEY (id);

-- Fix children
ALTER TABLE locations DROP COLUMN business_id;
ALTER TABLE locations RENAME COLUMN business_id_new TO business_id;
ALTER TABLE locations ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE locations ADD CONSTRAINT locations_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE equipment DROP COLUMN business_id;
ALTER TABLE equipment RENAME COLUMN business_id_new TO business_id;
ALTER TABLE equipment ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE equipment ADD CONSTRAINT equipment_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE staff_roles DROP COLUMN business_id;
ALTER TABLE staff_roles RENAME COLUMN business_id_new TO business_id;
ALTER TABLE staff_roles ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE staff_roles ADD CONSTRAINT staff_roles_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE services DROP COLUMN business_id;
ALTER TABLE services RENAME COLUMN business_id_new TO business_id;
ALTER TABLE services ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE services ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE roles DROP COLUMN business_id;
ALTER TABLE roles RENAME COLUMN business_id_new TO business_id;
ALTER TABLE roles ADD CONSTRAINT roles_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE user_role_assignments DROP COLUMN business_id;
ALTER TABLE user_role_assignments RENAME COLUMN business_id_new TO business_id;
ALTER TABLE user_role_assignments ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE user_role_assignments ADD CONSTRAINT user_role_assignments_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE invites DROP COLUMN business_id;
ALTER TABLE invites RENAME COLUMN business_id_new TO business_id;
ALTER TABLE invites ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE invites ADD CONSTRAINT invites_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE business_member_profiles DROP COLUMN business_id;
ALTER TABLE business_member_profiles RENAME COLUMN business_id_new TO business_id;
ALTER TABLE business_member_profiles ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE business_member_profiles ADD CONSTRAINT business_member_profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ─── 4. auth_tokens (no children) ─────────────────────────────────────────────

ALTER TABLE auth_tokens ADD COLUMN uuid UUID;
UPDATE auth_tokens SET uuid = id;
ALTER TABLE auth_tokens ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE auth_tokens ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_uuid_unique UNIQUE (uuid);

ALTER TABLE auth_tokens ADD COLUMN new_id BIGSERIAL;
ALTER TABLE auth_tokens DROP CONSTRAINT auth_tokens_pkey;
ALTER TABLE auth_tokens DROP COLUMN id;
ALTER TABLE auth_tokens RENAME COLUMN new_id TO id;
ALTER TABLE auth_tokens ADD PRIMARY KEY (id);

-- ─── 5. refresh_tokens (no children) ──────────────────────────────────────────

ALTER TABLE refresh_tokens ADD COLUMN uuid UUID;
UPDATE refresh_tokens SET uuid = id;
ALTER TABLE refresh_tokens ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE refresh_tokens ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_uuid_unique UNIQUE (uuid);

ALTER TABLE refresh_tokens ADD COLUMN new_id BIGSERIAL;
ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_pkey;
ALTER TABLE refresh_tokens DROP COLUMN id;
ALTER TABLE refresh_tokens RENAME COLUMN new_id TO id;
ALTER TABLE refresh_tokens ADD PRIMARY KEY (id);

-- ─── 6. locations ──────────────────────────────────────────────────────────────

ALTER TABLE locations ADD COLUMN uuid UUID;
UPDATE locations SET uuid = id;
ALTER TABLE locations ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE locations ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE locations ADD CONSTRAINT locations_uuid_unique UNIQUE (uuid);

ALTER TABLE locations ADD COLUMN new_id BIGSERIAL;

-- Children: schedules.location_id, location_photos.location_id,
--           location_equipment.location_id, location_staff_roles.location_id,
--           location_services.location_id,
--           user_role_assignments.location_id (nullable),
--           invites.location_id (nullable)

ALTER TABLE schedules ADD COLUMN location_id_new BIGINT;
UPDATE schedules SET location_id_new = l.new_id FROM locations l WHERE l.uuid = schedules.location_id::uuid;

ALTER TABLE location_photos ADD COLUMN location_id_new BIGINT;
UPDATE location_photos SET location_id_new = l.new_id FROM locations l WHERE l.uuid = location_photos.location_id::uuid;

ALTER TABLE location_equipment ADD COLUMN location_id_new BIGINT;
UPDATE location_equipment SET location_id_new = l.new_id FROM locations l WHERE l.uuid = location_equipment.location_id::uuid;

ALTER TABLE location_staff_roles ADD COLUMN location_id_new BIGINT;
UPDATE location_staff_roles SET location_id_new = l.new_id FROM locations l WHERE l.uuid = location_staff_roles.location_id::uuid;

ALTER TABLE location_services ADD COLUMN location_id_new BIGINT;
UPDATE location_services SET location_id_new = l.new_id FROM locations l WHERE l.uuid = location_services.location_id::uuid;

ALTER TABLE user_role_assignments ADD COLUMN location_id_new BIGINT;
UPDATE user_role_assignments SET location_id_new = l.new_id FROM locations l WHERE l.uuid = user_role_assignments.location_id::uuid;
-- NULL location_id rows remain NULL in location_id_new

ALTER TABLE invites ADD COLUMN location_id_new BIGINT;
UPDATE invites SET location_id_new = l.new_id FROM locations l WHERE l.uuid = invites.location_id::uuid;
-- NULL location_id rows remain NULL

-- Drop FK constraints referencing locations.id
ALTER TABLE schedules DROP CONSTRAINT schedules_location_id_fkey;
ALTER TABLE location_photos DROP CONSTRAINT location_photos_location_id_fkey;
ALTER TABLE location_equipment DROP CONSTRAINT location_equipment_location_id_fkey;
ALTER TABLE location_staff_roles DROP CONSTRAINT location_staff_roles_location_id_fkey;
ALTER TABLE location_services DROP CONSTRAINT location_services_location_id_fkey;
ALTER TABLE user_role_assignments DROP CONSTRAINT user_role_assignments_location_id_fkey;
ALTER TABLE invites DROP CONSTRAINT invites_location_id_fkey;

-- Drop locations PK
ALTER TABLE locations DROP CONSTRAINT locations_pkey;

ALTER TABLE locations DROP COLUMN id;
ALTER TABLE locations RENAME COLUMN new_id TO id;
ALTER TABLE locations ADD PRIMARY KEY (id);

-- Fix children
ALTER TABLE schedules DROP COLUMN location_id;
ALTER TABLE schedules RENAME COLUMN location_id_new TO location_id;
ALTER TABLE schedules ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE schedules ADD CONSTRAINT schedules_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;

ALTER TABLE location_photos DROP COLUMN location_id;
ALTER TABLE location_photos RENAME COLUMN location_id_new TO location_id;
ALTER TABLE location_photos ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE location_photos ADD CONSTRAINT location_photos_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;

ALTER TABLE location_equipment DROP COLUMN location_id;
ALTER TABLE location_equipment RENAME COLUMN location_id_new TO location_id;
ALTER TABLE location_equipment ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE location_equipment ADD CONSTRAINT location_equipment_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;

ALTER TABLE location_staff_roles DROP COLUMN location_id;
ALTER TABLE location_staff_roles RENAME COLUMN location_id_new TO location_id;
ALTER TABLE location_staff_roles ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE location_staff_roles ADD CONSTRAINT location_staff_roles_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;

ALTER TABLE location_services DROP COLUMN location_id;
ALTER TABLE location_services RENAME COLUMN location_id_new TO location_id;
ALTER TABLE location_services ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE location_services ADD CONSTRAINT location_services_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;

ALTER TABLE user_role_assignments DROP COLUMN location_id;
ALTER TABLE user_role_assignments RENAME COLUMN location_id_new TO location_id;
ALTER TABLE user_role_assignments ADD CONSTRAINT user_role_assignments_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;

ALTER TABLE invites DROP COLUMN location_id;
ALTER TABLE invites RENAME COLUMN location_id_new TO location_id;
ALTER TABLE invites ADD CONSTRAINT invites_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;

-- ─── 7. schedules ──────────────────────────────────────────────────────────────

ALTER TABLE schedules ADD COLUMN uuid UUID;
UPDATE schedules SET uuid = id;
ALTER TABLE schedules ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE schedules ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE schedules ADD CONSTRAINT schedules_uuid_unique UNIQUE (uuid);

ALTER TABLE schedules ADD COLUMN new_id BIGSERIAL;

-- Children: schedule_days.schedule_id, schedule_exceptions.schedule_id
ALTER TABLE schedule_days ADD COLUMN schedule_id_new BIGINT;
UPDATE schedule_days SET schedule_id_new = s.new_id FROM schedules s WHERE s.uuid = schedule_days.schedule_id::uuid;

ALTER TABLE schedule_exceptions ADD COLUMN schedule_id_new BIGINT;
UPDATE schedule_exceptions SET schedule_id_new = s.new_id FROM schedules s WHERE s.uuid = schedule_exceptions.schedule_id::uuid;

-- Drop FK constraints
ALTER TABLE schedule_days DROP CONSTRAINT schedule_days_schedule_id_fkey;
ALTER TABLE schedule_exceptions DROP CONSTRAINT schedule_exceptions_schedule_id_fkey;

-- Drop schedules PK and unique
ALTER TABLE schedules DROP CONSTRAINT schedules_location_id_key;
ALTER TABLE schedules DROP CONSTRAINT schedules_pkey;

ALTER TABLE schedules DROP COLUMN id;
ALTER TABLE schedules RENAME COLUMN new_id TO id;
ALTER TABLE schedules ADD PRIMARY KEY (id);
ALTER TABLE schedules ADD CONSTRAINT schedules_location_id_unique UNIQUE (location_id);

-- Fix children
ALTER TABLE schedule_days DROP COLUMN schedule_id;
ALTER TABLE schedule_days RENAME COLUMN schedule_id_new TO schedule_id;
ALTER TABLE schedule_days ALTER COLUMN schedule_id SET NOT NULL;
ALTER TABLE schedule_days ADD CONSTRAINT schedule_days_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;

ALTER TABLE schedule_exceptions DROP COLUMN schedule_id;
ALTER TABLE schedule_exceptions RENAME COLUMN schedule_id_new TO schedule_id;
ALTER TABLE schedule_exceptions ALTER COLUMN schedule_id SET NOT NULL;
ALTER TABLE schedule_exceptions ADD CONSTRAINT schedule_exceptions_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;

-- ─── 8. schedule_days (no children) ───────────────────────────────────────────

ALTER TABLE schedule_days ADD COLUMN uuid UUID;
UPDATE schedule_days SET uuid = id;
ALTER TABLE schedule_days ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE schedule_days ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE schedule_days ADD CONSTRAINT schedule_days_uuid_unique UNIQUE (uuid);

ALTER TABLE schedule_days ADD COLUMN new_id BIGSERIAL;
ALTER TABLE schedule_days DROP CONSTRAINT schedule_days_pkey;
ALTER TABLE schedule_days DROP COLUMN id;
ALTER TABLE schedule_days RENAME COLUMN new_id TO id;
ALTER TABLE schedule_days ADD PRIMARY KEY (id);

-- ─── 9. schedule_exceptions (no children) ─────────────────────────────────────

ALTER TABLE schedule_exceptions ADD COLUMN uuid UUID;
UPDATE schedule_exceptions SET uuid = id;
ALTER TABLE schedule_exceptions ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE schedule_exceptions ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE schedule_exceptions ADD CONSTRAINT schedule_exceptions_uuid_unique UNIQUE (uuid);

ALTER TABLE schedule_exceptions ADD COLUMN new_id BIGSERIAL;
ALTER TABLE schedule_exceptions DROP CONSTRAINT schedule_exceptions_pkey;
ALTER TABLE schedule_exceptions DROP COLUMN id;
ALTER TABLE schedule_exceptions RENAME COLUMN new_id TO id;
ALTER TABLE schedule_exceptions ADD PRIMARY KEY (id);

-- ─── 10. location_photos (no children) ────────────────────────────────────────

ALTER TABLE location_photos ADD COLUMN uuid UUID;
UPDATE location_photos SET uuid = id;
ALTER TABLE location_photos ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE location_photos ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE location_photos ADD CONSTRAINT location_photos_uuid_unique UNIQUE (uuid);

ALTER TABLE location_photos ADD COLUMN new_id BIGSERIAL;
ALTER TABLE location_photos DROP CONSTRAINT location_photos_pkey;
ALTER TABLE location_photos DROP COLUMN id;
ALTER TABLE location_photos RENAME COLUMN new_id TO id;
ALTER TABLE location_photos ADD PRIMARY KEY (id);

-- ─── 11. equipment ─────────────────────────────────────────────────────────────

ALTER TABLE equipment ADD COLUMN uuid UUID;
UPDATE equipment SET uuid = id;
ALTER TABLE equipment ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE equipment ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE equipment ADD CONSTRAINT equipment_uuid_unique UNIQUE (uuid);

ALTER TABLE equipment ADD COLUMN new_id BIGSERIAL;

-- Children: location_equipment.equipment_id, service_equipment_requirements.equipment_id
ALTER TABLE location_equipment ADD COLUMN equipment_id_new BIGINT;
UPDATE location_equipment SET equipment_id_new = e.new_id FROM equipment e WHERE e.uuid = location_equipment.equipment_id::uuid;

ALTER TABLE service_equipment_requirements ADD COLUMN equipment_id_new BIGINT;
UPDATE service_equipment_requirements SET equipment_id_new = e.new_id FROM equipment e WHERE e.uuid = service_equipment_requirements.equipment_id::uuid;

-- Drop FK constraints
ALTER TABLE location_equipment DROP CONSTRAINT location_equipment_equipment_id_fkey;
ALTER TABLE service_equipment_requirements DROP CONSTRAINT service_equipment_requirements_equipment_id_fkey;

-- Drop equipment PK
ALTER TABLE equipment DROP CONSTRAINT equipment_pkey;

ALTER TABLE equipment DROP COLUMN id;
ALTER TABLE equipment RENAME COLUMN new_id TO id;
ALTER TABLE equipment ADD PRIMARY KEY (id);

-- Fix children
ALTER TABLE location_equipment DROP COLUMN equipment_id;
ALTER TABLE location_equipment RENAME COLUMN equipment_id_new TO equipment_id;
ALTER TABLE location_equipment ALTER COLUMN equipment_id SET NOT NULL;
ALTER TABLE location_equipment ADD CONSTRAINT location_equipment_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE;

ALTER TABLE service_equipment_requirements DROP COLUMN equipment_id;
ALTER TABLE service_equipment_requirements RENAME COLUMN equipment_id_new TO equipment_id;
ALTER TABLE service_equipment_requirements ALTER COLUMN equipment_id SET NOT NULL;
ALTER TABLE service_equipment_requirements ADD CONSTRAINT service_equipment_requirements_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE;

-- ─── 12. staff_roles ───────────────────────────────────────────────────────────

ALTER TABLE staff_roles ADD COLUMN uuid UUID;
UPDATE staff_roles SET uuid = id;
ALTER TABLE staff_roles ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE staff_roles ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE staff_roles ADD CONSTRAINT staff_roles_uuid_unique UNIQUE (uuid);

ALTER TABLE staff_roles ADD COLUMN new_id BIGSERIAL;

-- Children: location_staff_roles.staff_role_id, service_staff_requirements.staff_role_id
ALTER TABLE location_staff_roles ADD COLUMN staff_role_id_new BIGINT;
UPDATE location_staff_roles SET staff_role_id_new = sr.new_id FROM staff_roles sr WHERE sr.uuid = location_staff_roles.staff_role_id::uuid;

ALTER TABLE service_staff_requirements ADD COLUMN staff_role_id_new BIGINT;
UPDATE service_staff_requirements SET staff_role_id_new = sr.new_id FROM staff_roles sr WHERE sr.uuid = service_staff_requirements.staff_role_id::uuid;

-- Drop FK constraints
ALTER TABLE location_staff_roles DROP CONSTRAINT location_staff_roles_staff_role_id_fkey;
ALTER TABLE service_staff_requirements DROP CONSTRAINT service_staff_requirements_staff_role_id_fkey;

-- Drop staff_roles PK
ALTER TABLE staff_roles DROP CONSTRAINT staff_roles_pkey;

ALTER TABLE staff_roles DROP COLUMN id;
ALTER TABLE staff_roles RENAME COLUMN new_id TO id;
ALTER TABLE staff_roles ADD PRIMARY KEY (id);

-- Fix children
ALTER TABLE location_staff_roles DROP COLUMN staff_role_id;
ALTER TABLE location_staff_roles RENAME COLUMN staff_role_id_new TO staff_role_id;
ALTER TABLE location_staff_roles ALTER COLUMN staff_role_id SET NOT NULL;
ALTER TABLE location_staff_roles ADD CONSTRAINT location_staff_roles_staff_role_id_fkey FOREIGN KEY (staff_role_id) REFERENCES staff_roles(id) ON DELETE CASCADE;

ALTER TABLE service_staff_requirements DROP COLUMN staff_role_id;
ALTER TABLE service_staff_requirements RENAME COLUMN staff_role_id_new TO staff_role_id;
ALTER TABLE service_staff_requirements ALTER COLUMN staff_role_id SET NOT NULL;
ALTER TABLE service_staff_requirements ADD CONSTRAINT service_staff_requirements_staff_role_id_fkey FOREIGN KEY (staff_role_id) REFERENCES staff_roles(id) ON DELETE CASCADE;

-- ─── 13. services ──────────────────────────────────────────────────────────────

ALTER TABLE services ADD COLUMN uuid UUID;
UPDATE services SET uuid = id;
ALTER TABLE services ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE services ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE services ADD CONSTRAINT services_uuid_unique UNIQUE (uuid);

ALTER TABLE services ADD COLUMN new_id BIGSERIAL;

-- Children: location_services.service_id, service_equipment_requirements.service_id,
--           service_staff_requirements.service_id
ALTER TABLE location_services ADD COLUMN service_id_new BIGINT;
UPDATE location_services SET service_id_new = s.new_id FROM services s WHERE s.uuid = location_services.service_id::uuid;

ALTER TABLE service_equipment_requirements ADD COLUMN service_id_new BIGINT;
UPDATE service_equipment_requirements SET service_id_new = s.new_id FROM services s WHERE s.uuid = service_equipment_requirements.service_id::uuid;

ALTER TABLE service_staff_requirements ADD COLUMN service_id_new BIGINT;
UPDATE service_staff_requirements SET service_id_new = s.new_id FROM services s WHERE s.uuid = service_staff_requirements.service_id::uuid;

-- Drop FK constraints
ALTER TABLE location_services DROP CONSTRAINT location_services_service_id_fkey;
ALTER TABLE service_equipment_requirements DROP CONSTRAINT service_equipment_requirements_service_id_fkey;
ALTER TABLE service_staff_requirements DROP CONSTRAINT service_staff_requirements_service_id_fkey;

-- Drop services PK
ALTER TABLE services DROP CONSTRAINT services_pkey;

ALTER TABLE services DROP COLUMN id;
ALTER TABLE services RENAME COLUMN new_id TO id;
ALTER TABLE services ADD PRIMARY KEY (id);

-- Fix children
ALTER TABLE location_services DROP COLUMN service_id;
ALTER TABLE location_services RENAME COLUMN service_id_new TO service_id;
ALTER TABLE location_services ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE location_services ADD CONSTRAINT location_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;

ALTER TABLE service_equipment_requirements DROP COLUMN service_id;
ALTER TABLE service_equipment_requirements RENAME COLUMN service_id_new TO service_id;
ALTER TABLE service_equipment_requirements ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE service_equipment_requirements ADD CONSTRAINT service_equipment_requirements_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;

ALTER TABLE service_staff_requirements DROP COLUMN service_id;
ALTER TABLE service_staff_requirements RENAME COLUMN service_id_new TO service_id;
ALTER TABLE service_staff_requirements ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE service_staff_requirements ADD CONSTRAINT service_staff_requirements_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;

-- ─── 14-18. Leaf pivot tables (no further children) ───────────────────────────

-- location_equipment
ALTER TABLE location_equipment ADD COLUMN uuid UUID;
UPDATE location_equipment SET uuid = id;
ALTER TABLE location_equipment ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE location_equipment ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE location_equipment ADD CONSTRAINT location_equipment_uuid_unique UNIQUE (uuid);
ALTER TABLE location_equipment ADD COLUMN new_id BIGSERIAL;
ALTER TABLE location_equipment DROP CONSTRAINT location_equipment_pkey;
ALTER TABLE location_equipment DROP COLUMN id;
ALTER TABLE location_equipment RENAME COLUMN new_id TO id;
ALTER TABLE location_equipment ADD PRIMARY KEY (id);

-- location_staff_roles
ALTER TABLE location_staff_roles ADD COLUMN uuid UUID;
UPDATE location_staff_roles SET uuid = id;
ALTER TABLE location_staff_roles ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE location_staff_roles ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE location_staff_roles ADD CONSTRAINT location_staff_roles_uuid_unique UNIQUE (uuid);
ALTER TABLE location_staff_roles ADD COLUMN new_id BIGSERIAL;
ALTER TABLE location_staff_roles DROP CONSTRAINT location_staff_roles_pkey;
ALTER TABLE location_staff_roles DROP COLUMN id;
ALTER TABLE location_staff_roles RENAME COLUMN new_id TO id;
ALTER TABLE location_staff_roles ADD PRIMARY KEY (id);

-- location_services
ALTER TABLE location_services ADD COLUMN uuid UUID;
UPDATE location_services SET uuid = id;
ALTER TABLE location_services ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE location_services ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE location_services ADD CONSTRAINT location_services_uuid_unique UNIQUE (uuid);
ALTER TABLE location_services ADD COLUMN new_id BIGSERIAL;
ALTER TABLE location_services DROP CONSTRAINT location_services_pkey;
ALTER TABLE location_services DROP COLUMN id;
ALTER TABLE location_services RENAME COLUMN new_id TO id;
ALTER TABLE location_services ADD PRIMARY KEY (id);

-- service_equipment_requirements
ALTER TABLE service_equipment_requirements ADD COLUMN uuid UUID;
UPDATE service_equipment_requirements SET uuid = id;
ALTER TABLE service_equipment_requirements ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE service_equipment_requirements ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE service_equipment_requirements ADD CONSTRAINT service_equipment_requirements_uuid_unique UNIQUE (uuid);
ALTER TABLE service_equipment_requirements ADD COLUMN new_id BIGSERIAL;
ALTER TABLE service_equipment_requirements DROP CONSTRAINT service_equipment_requirements_pkey;
ALTER TABLE service_equipment_requirements DROP COLUMN id;
ALTER TABLE service_equipment_requirements RENAME COLUMN new_id TO id;
ALTER TABLE service_equipment_requirements ADD PRIMARY KEY (id);

-- service_staff_requirements
ALTER TABLE service_staff_requirements ADD COLUMN uuid UUID;
UPDATE service_staff_requirements SET uuid = id;
ALTER TABLE service_staff_requirements ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE service_staff_requirements ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE service_staff_requirements ADD CONSTRAINT service_staff_requirements_uuid_unique UNIQUE (uuid);
ALTER TABLE service_staff_requirements ADD COLUMN new_id BIGSERIAL;
ALTER TABLE service_staff_requirements DROP CONSTRAINT service_staff_requirements_pkey;
ALTER TABLE service_staff_requirements DROP COLUMN id;
ALTER TABLE service_staff_requirements RENAME COLUMN new_id TO id;
ALTER TABLE service_staff_requirements ADD PRIMARY KEY (id);

-- ─── 19. roles ─────────────────────────────────────────────────────────────────
-- Special: seeded rows with fixed UUIDs get new integer ids.
-- After BIGSERIAL is added, existing rows get sequential IDs starting from 1.

ALTER TABLE roles ADD COLUMN uuid UUID;
UPDATE roles SET uuid = id;
ALTER TABLE roles ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE roles ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE roles ADD CONSTRAINT roles_uuid_unique UNIQUE (uuid);

ALTER TABLE roles ADD COLUMN new_id BIGSERIAL;

-- Children: role_permissions.role_id, user_role_assignments.role_id, invites.role_id
ALTER TABLE role_permissions ADD COLUMN role_id_new BIGINT;
UPDATE role_permissions SET role_id_new = r.new_id FROM roles r WHERE r.uuid = role_permissions.role_id::uuid;

ALTER TABLE user_role_assignments ADD COLUMN role_id_new BIGINT;
UPDATE user_role_assignments SET role_id_new = r.new_id FROM roles r WHERE r.uuid = user_role_assignments.role_id::uuid;

ALTER TABLE invites ADD COLUMN role_id_new BIGINT;
UPDATE invites SET role_id_new = r.new_id FROM roles r WHERE r.uuid = invites.role_id::uuid;

-- Drop FK constraints referencing roles.id
ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_role_id_fkey;
ALTER TABLE user_role_assignments DROP CONSTRAINT user_role_assignments_role_id_fkey;
ALTER TABLE invites DROP CONSTRAINT invites_role_id_fkey;

-- Drop roles PK and unique constraint
ALTER TABLE roles DROP CONSTRAINT roles_slug_scope_unique;
ALTER TABLE roles DROP CONSTRAINT roles_pkey;

ALTER TABLE roles DROP COLUMN id;
ALTER TABLE roles RENAME COLUMN new_id TO id;
ALTER TABLE roles ADD PRIMARY KEY (id);
ALTER TABLE roles ADD CONSTRAINT roles_slug_scope_unique UNIQUE NULLS NOT DISTINCT (business_id, slug);

-- Fix children
ALTER TABLE role_permissions DROP COLUMN role_id;
ALTER TABLE role_permissions RENAME COLUMN role_id_new TO role_id;
ALTER TABLE role_permissions ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

ALTER TABLE user_role_assignments DROP COLUMN role_id;
ALTER TABLE user_role_assignments RENAME COLUMN role_id_new TO role_id;
ALTER TABLE user_role_assignments ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE user_role_assignments ADD CONSTRAINT user_role_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

ALTER TABLE invites DROP COLUMN role_id;
ALTER TABLE invites RENAME COLUMN role_id_new TO role_id;
ALTER TABLE invites ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE invites ADD CONSTRAINT invites_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

-- ─── 20. role_permissions (no children) ───────────────────────────────────────

ALTER TABLE role_permissions ADD COLUMN uuid UUID;
UPDATE role_permissions SET uuid = id;
ALTER TABLE role_permissions ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE role_permissions ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_uuid_unique UNIQUE (uuid);
ALTER TABLE role_permissions ADD COLUMN new_id BIGSERIAL;
ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_pkey;
ALTER TABLE role_permissions DROP COLUMN id;
ALTER TABLE role_permissions RENAME COLUMN new_id TO id;
ALTER TABLE role_permissions ADD PRIMARY KEY (id);

-- ─── 21. user_role_assignments ─────────────────────────────────────────────────
-- Drop old unique constraint (uses old UUID columns), add new one

ALTER TABLE user_role_assignments DROP CONSTRAINT user_role_assignments_unique;

ALTER TABLE user_role_assignments ADD COLUMN uuid UUID;
UPDATE user_role_assignments SET uuid = id;
ALTER TABLE user_role_assignments ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE user_role_assignments ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE user_role_assignments ADD CONSTRAINT user_role_assignments_uuid_unique UNIQUE (uuid);
ALTER TABLE user_role_assignments ADD COLUMN new_id BIGSERIAL;
ALTER TABLE user_role_assignments DROP CONSTRAINT user_role_assignments_pkey;
ALTER TABLE user_role_assignments DROP COLUMN id;
ALTER TABLE user_role_assignments RENAME COLUMN new_id TO id;
ALTER TABLE user_role_assignments ADD PRIMARY KEY (id);

ALTER TABLE user_role_assignments ADD CONSTRAINT user_role_assignments_unique
    UNIQUE NULLS NOT DISTINCT (user_id, role_id, business_id, location_id);

-- ─── 22. invites (no children) ────────────────────────────────────────────────

ALTER TABLE invites ADD COLUMN uuid UUID;
UPDATE invites SET uuid = id;
ALTER TABLE invites ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE invites ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE invites ADD CONSTRAINT invites_uuid_unique UNIQUE (uuid);
ALTER TABLE invites ADD COLUMN new_id BIGSERIAL;
ALTER TABLE invites DROP CONSTRAINT invites_pkey;
ALTER TABLE invites DROP COLUMN id;
ALTER TABLE invites RENAME COLUMN new_id TO id;
ALTER TABLE invites ADD PRIMARY KEY (id);

-- ─── 23. business_member_profiles (no children) ───────────────────────────────

ALTER TABLE business_member_profiles DROP CONSTRAINT business_member_profiles_pkey;

ALTER TABLE business_member_profiles ADD COLUMN uuid UUID;
UPDATE business_member_profiles SET uuid = id;
ALTER TABLE business_member_profiles ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE business_member_profiles ALTER COLUMN uuid SET DEFAULT gen_random_uuid();
ALTER TABLE business_member_profiles ADD CONSTRAINT business_member_profiles_uuid_unique UNIQUE (uuid);
ALTER TABLE business_member_profiles ADD COLUMN new_id BIGSERIAL;
ALTER TABLE business_member_profiles DROP COLUMN id;
ALTER TABLE business_member_profiles RENAME COLUMN new_id TO id;
ALTER TABLE business_member_profiles ADD PRIMARY KEY (id);

-- ─── Rebuild indexes that referenced old UUID columns ─────────────────────────

-- Recreate the unique index on invites token_hash (still varchar, no change needed)
-- Just verify it exists -- it was a CREATE UNIQUE INDEX not a constraint, so check
-- whether migration 013 created it as an index (not constraint).
-- The DROP CONSTRAINT above for invites_pkey won't affect it.
-- The index idx_invites_token_hash was created by migration 013 and references
-- no ID columns, so it remains valid.

COMMIT;
