CREATE TABLE alpha_access_requests (
    id           BIGSERIAL PRIMARY KEY,
    uuid         UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    email        VARCHAR(254) NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    description  TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
