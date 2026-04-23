CREATE TABLE bookings (
    id           BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid         UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    location_id  BIGINT        NOT NULL REFERENCES locations(id),
    consumer_id  BIGINT        NOT NULL REFERENCES users(id),
    status       TEXT          NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('pending_payment','confirmed','cancelled_by_customer',
                                   'cancelled_by_provider','completed','no_show')),
    total_amount NUMERIC(10,2) NOT NULL,
    currency     CHAR(3)       NOT NULL DEFAULT 'EUR',
    notes        TEXT,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_items (
    id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid             UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    booking_id       BIGINT        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_id       BIGINT        NOT NULL REFERENCES services(id),
    start_at         TIMESTAMPTZ   NOT NULL,
    end_at           TIMESTAMPTZ   NOT NULL,
    duration_minutes INTEGER       NOT NULL,
    price            NUMERIC(10,2) NOT NULL,
    status           TEXT          NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed','cancelled','completed')),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Prevent double-booking: same service cannot have two active items at the same start time
CREATE UNIQUE INDEX booking_items_no_overlap
    ON booking_items (service_id, start_at)
    WHERE status != 'cancelled';

CREATE INDEX idx_bookings_consumer  ON bookings (consumer_id);
CREATE INDEX idx_bookings_location  ON bookings (location_id);
CREATE INDEX idx_booking_items_booking ON booking_items (booking_id);
CREATE INDEX idx_booking_items_service ON booking_items (service_id);

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
