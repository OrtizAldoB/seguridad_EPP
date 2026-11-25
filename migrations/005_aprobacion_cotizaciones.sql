-- 005_aprobacion_cotizaciones.sql
-- La aprobación deja de ser válida cuando se edita una cotización.
BEGIN;

ALTER TABLE cotizaciones ADD COLUMN aprobada_en TEXT;

COMMIT;
