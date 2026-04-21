CREATE TABLE locations (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    business_id BIGINT       NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    address     VARCHAR(200) NOT NULL,
    city        VARCHAR(100) NOT NULL,
    country     VARCHAR(100) NOT NULL DEFAULT 'Lithuania',
    phone       VARCHAR(50),
    email       VARCHAR(255),
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    timezone    VARCHAR(100) NOT NULL DEFAULT 'Europe/Vilnius',
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_locations_business_id ON locations(business_id);
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE schedules (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    location_id BIGINT      NOT NULL UNIQUE REFERENCES locations(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_days (
    id          BIGINT   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID     NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    schedule_id BIGINT   NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_open     BOOLEAN  NOT NULL DEFAULT false,
    open_time   TIME,
    close_time  TIME,
    UNIQUE (schedule_id, day_of_week)
);

CREATE TABLE schedule_exceptions (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    schedule_id BIGINT      NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    date        DATE        NOT NULL,
    is_closed   BOOLEAN     NOT NULL DEFAULT true,
    open_time   TIME,
    close_time  TIME,
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (schedule_id, date)
);
CREATE INDEX idx_schedule_exceptions_date ON schedule_exceptions(schedule_id, date);

CREATE TABLE location_photos (
    id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid          UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    location_id   BIGINT      NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    url           TEXT        NOT NULL,
    display_order SMALLINT    NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_location_photos_location_id ON location_photos(location_id);
