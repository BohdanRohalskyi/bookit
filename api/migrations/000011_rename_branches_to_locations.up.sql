-- Rename main table
ALTER TABLE branches RENAME TO locations;
ALTER INDEX idx_branches_business_id RENAME TO idx_locations_business_id;

-- Rename schedules column
ALTER TABLE schedules RENAME COLUMN branch_id TO location_id;

-- Rename branch_photos table, column, and index
ALTER TABLE branch_photos RENAME TO location_photos;
ALTER TABLE location_photos RENAME COLUMN branch_id TO location_id;
ALTER INDEX idx_branch_photos_branch_id RENAME TO idx_location_photos_location_id;

-- Rename pivot tables, columns, and indexes
ALTER TABLE branch_equipment RENAME TO location_equipment;
ALTER TABLE location_equipment RENAME COLUMN branch_id TO location_id;
ALTER INDEX idx_branch_equipment_branch_id RENAME TO idx_location_equipment_location_id;

ALTER TABLE branch_staff_roles RENAME TO location_staff_roles;
ALTER TABLE location_staff_roles RENAME COLUMN branch_id TO location_id;
ALTER INDEX idx_branch_staff_roles_branch_id RENAME TO idx_location_staff_roles_location_id;

ALTER TABLE branch_services RENAME TO location_services;
ALTER TABLE location_services RENAME COLUMN branch_id TO location_id;
ALTER INDEX idx_branch_services_branch_id RENAME TO idx_location_services_location_id;
