-- Enables gen_random_uuid(), used as the default for every table's
-- primary key starting M1 (see docs/SPEC.md A6).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
