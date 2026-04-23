CREATE TABLE booking_status_history (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid       UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    booking_id BIGINT      NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status   TEXT        NOT NULL,
    changed_by  BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    reason      TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bsh_booking ON booking_status_history(booking_id);
