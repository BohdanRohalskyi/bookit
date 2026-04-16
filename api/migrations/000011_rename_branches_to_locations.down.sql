-- Revert pivot tables, columns, and indexes
ALTER TABLE location_services RENAME TO branch_services;
ALTER TABLE branch_services RENAME COLUMN location_id TO branch_id;
ALTER INDEX idx_location_services_location_id RENAME TO idx_branch_services_branch_id;

ALTER TABLE location_staff_roles RENAME TO branch_staff_roles;
ALTER TABLE branch_staff_roles RENAME COLUMN location_id TO branch_id;
ALTER INDEX idx_location_staff_roles_location_id RENAME TO idx_branch_staff_roles_branch_id;

ALTER TABLE location_equipment RENAME TO branch_equipment;
ALTER TABLE branch_equipment RENAME COLUMN location_id TO branch_id;
ALTER INDEX idx_location_equipment_location_id RENAME TO idx_branch_equipment_branch_id;

-- Revert location_photos table, column, and index
ALTER TABLE location_photos RENAME TO branch_photos;
ALTER TABLE branch_photos RENAME COLUMN location_id TO branch_id;
ALTER INDEX idx_location_photos_location_id RENAME TO idx_branch_photos_branch_id;

-- Revert schedules column
ALTER TABLE schedules RENAME COLUMN location_id TO branch_id;

-- Revert main table
ALTER TABLE locations RENAME TO branches;
ALTER INDEX idx_locations_business_id RENAME TO idx_branches_business_id;
