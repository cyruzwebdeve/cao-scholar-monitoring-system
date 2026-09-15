-- Persist the form directory so Catalog, Scholar Portal, Billing and Payroll
-- share the same database entries. Never overwrite an existing saved Public or
-- Private classification, school ID, name, or scholar link.
-- UCN public status: Republic Act No. 11399, sections 1 and 2.
-- https://ldr.senate.gov.ph/legislative-issuance/republic-act-no-11399
BEGIN;
ALTER TABLE "schools" ALTER COLUMN "school_type" SET DEFAULT 'unclassified';

CREATE TEMP TABLE pgceap_catalog_defaults (name TEXT, school_type TEXT) ON COMMIT DROP;
INSERT INTO pgceap_catalog_defaults (name, school_type) VALUES
  ('Camarines Norte College', 'unclassified'),
  ('Camarines Norte International School Inc.', 'unclassified'),
  ('Camarines Norte School of Law', 'unclassified'),
  ('Camarines Norte School of Law, Arts and Sciences Inc.', 'unclassified'),
  ('University of Camarines Norte, Abaňo Campus', 'public'),
  ('University of Camarines Norte, Entienza Campus', 'public'),
  ('University of Camarines Norte, Jose Panganiban Campus', 'public'),
  ('University of Camarines Norte, Labo Campus', 'public'),
  ('University of Camarines Norte, Main Campus', 'public'),
  ('University of Camarines Norte, Mercedes Campus', 'public'),
  ('Capalonga College', 'unclassified'),
  ('Daet College of Science and Technological Studies, Inc.', 'unclassified'),
  ('Daet College of Science and Technology', 'unclassified'),
  ('Hope Science And Technology College Corp.', 'unclassified'),
  ('La Consolacion College - Daet', 'unclassified'),
  ('Lyceum of St. Dominic Inc.', 'unclassified'),
  ('Mabini Colleges, Inc.', 'unclassified'),
  ('Microsystems College Foundation', 'unclassified'),
  ('Northhills College of Asia (NCA), Inc.', 'unclassified'),
  ('Our Lady of Lourdes College Foundation, Inc.', 'unclassified'),
  ('Philippines Womens University', 'unclassified'),
  ('St. Francis Caracciolo Culinary Academy', 'unclassified'),
  ('Sta. Elena College, Inc.', 'unclassified'),
  ('Vineyard Asia Technological College, Inc.', 'unclassified');

-- Match exactly after NFC, case, trim and whitespace normalization; this is
-- not a name-based classifier or fuzzy institution alias matching.
UPDATE "schools" AS saved
SET school_type = defaults.school_type, updated_at = CURRENT_TIMESTAMP
FROM pgceap_catalog_defaults AS defaults
WHERE defaults.school_type = 'public'
  AND lower(btrim(saved.school_type)) NOT IN ('public', 'private')
  AND lower(regexp_replace(btrim(normalize(saved.name, NFC)), '\s+', ' ', 'g'))
    = lower(regexp_replace(btrim(normalize(defaults.name, NFC)), '\s+', ' ', 'g'));

INSERT INTO "schools" (name, school_type, is_active, created_at, updated_at)
SELECT defaults.name, defaults.school_type, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM pgceap_catalog_defaults AS defaults
WHERE NOT EXISTS (
  SELECT 1 FROM "schools" AS saved
  WHERE lower(regexp_replace(btrim(normalize(saved.name, NFC)), '\s+', ' ', 'g'))
    = lower(regexp_replace(btrim(normalize(defaults.name, NFC)), '\s+', ' ', 'g'))
)
ON CONFLICT (name) DO NOTHING;
COMMIT;
