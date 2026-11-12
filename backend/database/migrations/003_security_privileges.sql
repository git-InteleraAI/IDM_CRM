-- =========================================================
-- INTELERA DM PORTAL
-- Migration: 003_security_privileges
-- Purpose: Remove excessive database privileges
-- =========================================================

-- Remove all table privileges from anonymous users.
REVOKE ALL PRIVILEGES
ON ALL TABLES IN SCHEMA public
FROM anon;

-- Remove all existing table privileges from authenticated users.
REVOKE ALL PRIVILEGES
ON ALL TABLES IN SCHEMA public
FROM authenticated;

-- Authenticated users receive only necessary DML privileges.
-- RLS policies determine which rows and operations are allowed.
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO authenticated;

-- Prevent anonymous users from receiving privileges on
-- future tables created by the postgres role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON TABLES FROM anon;

-- =========================================================
-- END OF MIGRATION
-- =========================================================