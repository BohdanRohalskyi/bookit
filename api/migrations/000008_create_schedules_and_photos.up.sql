-- ─── Schedules ────────────────────────────────────────────────────────────────

CREATE TABLE schedules (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id  UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_days (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_open     BOOLEAN NOT NULL DEFAULT false,
    open_time   TIME,
    close_time  TIME,
    UNIQUE (schedule_id, day_of_week)
);

CREATE TABLE schedule_exceptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    is_closed   BOOLEAN NOT NULL DEFAULT true,
    open_time   TIME,
    close_time  TIME,
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (schedule_id, date)
);

CREATE INDEX idx_schedule_exceptions_date ON schedule_exceptions(schedule_id, date);

-- ─── Branch photos ─────────────────────────────────────────────────────────────

CREATE TABLE branch_photos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    url           TEXT NOT NULL,
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branch_photos_branch_id ON branch_photos(branch_id);
