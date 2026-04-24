ALTER TABLE equipment
    ADD COLUMN quantity_active   SMALLINT NOT NULL DEFAULT 0 CHECK (quantity_active   >= 0),
    ADD COLUMN quantity_inactive SMALLINT NOT NULL DEFAULT 0 CHECK (quantity_inactive >= 0);
