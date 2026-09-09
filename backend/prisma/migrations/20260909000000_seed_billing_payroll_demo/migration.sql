-- Idempotent, visibly labelled test scholars for production Billing/Payroll verification.
-- Login is disabled for their control accounts; these records are staff workflow fixtures only.
DO $$
DECLARE
  selected_period_id INTEGER;
  selected_school_year VARCHAR(20);
  selected_semester VARCHAR(30);
  public_school_id INTEGER;
  private_school_id INTEGER;
  demo RECORD;
  selected_applicant_id INTEGER;
BEGIN
  SELECT id, school_year, semester
    INTO selected_period_id, selected_school_year, selected_semester
  FROM academic_periods
  WHERE is_active = TRUE
  ORDER BY is_primary DESC, updated_at DESC, id DESC
  LIMIT 1;

  IF selected_period_id IS NULL THEN
    INSERT INTO academic_periods (school_year, semester, status, is_active, is_primary, updated_at)
    VALUES ('2026-2027', '1st Semester', 'active', TRUE, TRUE, CURRENT_TIMESTAMP)
    ON CONFLICT (school_year, semester) DO UPDATE
      SET status = 'active', is_active = TRUE, is_primary = TRUE, updated_at = CURRENT_TIMESTAMP
    RETURNING id, school_year, semester
      INTO selected_period_id, selected_school_year, selected_semester;
  END IF;

  INSERT INTO schools (name, school_type, is_active, updated_at)
  VALUES ('PGCEAP Public Workflow Test School', 'public', TRUE, CURRENT_TIMESTAMP)
  ON CONFLICT (name) DO UPDATE
    SET school_type = 'public', is_active = TRUE, updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO public_school_id;

  INSERT INTO schools (name, school_type, is_active, updated_at)
  VALUES ('PGCEAP Private Workflow Test School', 'private', TRUE, CURRENT_TIMESTAMP)
  ON CONFLICT (name) DO UPDATE
    SET school_type = 'private', is_active = TRUE, updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO private_school_id;

  FOR demo IN
    SELECT * FROM (VALUES
      ('PUB01', 'PUBLIC', 'ONE', public_school_id, 12500.00),
      ('PUB02', 'PUBLIC', 'TWO', public_school_id, 13750.00),
      ('PRV01', 'PRIVATE', 'ONE', private_school_id, 18500.00),
      ('PRV02', 'PRIVATE', 'TWO', private_school_id, 19250.00)
    ) AS fixtures(code, classification, sequence_name, school_id, billing_amount)
  LOOP
    INSERT INTO applicants (
      first_name, middle_name, last_name, email, phone, street, barangay,
      municipality, school_id, gender, date_of_birth, birthplace, civil_status,
      family_income, gwa, guardians, status, school_year, deleted_at, updated_at
    ) VALUES (
      'TEST', demo.classification, 'SCHOLAR ' || demo.sequence_name,
      'billing.workflow.' || LOWER(demo.code) || '@pgceap.test',
      NULL, 'TEST DATA - NOT A REAL ADDRESS', 'Test Barangay', 'Daet',
      demo.school_id, NULL, NULL, 'TEST DATA', 'Single',
      'Test data', 1.50, 'TEST DATA', 'passed', selected_school_year, NULL,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (email) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      last_name = EXCLUDED.last_name,
      school_id = EXCLUDED.school_id,
      status = 'passed',
      school_year = selected_school_year,
      deleted_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO selected_applicant_id;

    INSERT INTO control_accounts (
      applicant_id, control_number, username, password_hash, is_active,
      updated_at
    ) VALUES (
      selected_applicant_id,
      'PGC-TEST-' || demo.code,
      'billing.workflow.' || LOWER(demo.code) || '@pgceap.test',
      '$2a$12$uwVCP8UU9XX7uGuV7CzejO8.RoykcULtIVo2DLvM2bhLI5/62oTUC',
      FALSE, CURRENT_TIMESTAMP
    )
    ON CONFLICT (applicant_id) DO UPDATE SET
      control_number = EXCLUDED.control_number,
      username = EXCLUDED.username,
      password_hash = EXCLUDED.password_hash,
      is_active = FALSE,
      updated_at = CURRENT_TIMESTAMP;

    INSERT INTO application_submissions (
      applicant_id, email, identity, address, school_plan, family,
      eligibility, initial_docs, status, updated_at
    )
    SELECT
      selected_applicant_id,
      'billing.workflow.' || LOWER(demo.code) || '@pgceap.test',
      jsonb_build_object(
        'firstName', 'TEST', 'middleName', demo.classification,
        'familyName', 'SCHOLAR ' || demo.sequence_name,
        'email', 'billing.workflow.' || LOWER(demo.code) || '@pgceap.test'
      ),
      jsonb_build_object('municipality', 'Daet', 'barangay', 'Test Barangay'),
      jsonb_build_object(
        'school', CASE WHEN demo.classification = 'PUBLIC'
          THEN 'PGCEAP Public Workflow Test School'
          ELSE 'PGCEAP Private Workflow Test School' END,
        'course', 'Test Program', 'incomingYearLevel', '1st Year'
      ),
      jsonb_build_object('familyIncome', 'Test data', 'gwa', '1.50'),
      '{}'::jsonb,
      jsonb_build_object('requirements', '{}'::jsonb),
      'Scholar',
      CURRENT_TIMESTAMP
    WHERE NOT EXISTS (
      SELECT 1 FROM application_submissions WHERE applicant_id = selected_applicant_id
    );

    INSERT INTO scholar_accounts (
      applicant_id, scholar_id, is_active, notes, updated_at
    )
    VALUES (
      selected_applicant_id,
      'TEST-SCH-' || demo.code,
      TRUE,
      'DUMMY DATA - Billing and Payroll workflow verification',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (applicant_id) DO UPDATE SET
      is_active = TRUE,
      notes = EXCLUDED.notes,
      updated_at = CURRENT_TIMESTAMP;

    INSERT INTO scholar_requirements (
      applicant_id, billing_period_id, school_id, year_level, course,
      billing_amount, billing_notes, billing_school_year, billing_semester,
      billing_status, cert_tax_exemption_file,
      cert_tax_exemption_review_status, barangay_indigency_file,
      barangay_indigency_review_status, valid_id_photocopy_file,
      valid_id_photocopy_review_status, registration_form_file,
      registration_form_review_status, tuition_fee_receipt_file,
      tuition_fee_receipt_review_status, grade_report_file,
      grade_report_review_status, folder_physical_submitted,
      folder_physical_submitted_at, updated_at
    ) VALUES (
      selected_applicant_id, selected_period_id, demo.school_id, '1st Year',
      'Test Program', demo.billing_amount,
      'DUMMY DATA - Safe Billing and Payroll workflow fixture',
      selected_school_year, selected_semester, 'Ready for billing',
      'DUMMY-APPROVED-TAX-EXEMPTION', 'approved',
      'DUMMY-APPROVED-INDIGENCY', 'approved',
      'DUMMY-APPROVED-VALID-ID', 'approved',
      'DUMMY-APPROVED-REGISTRATION', 'approved',
      CASE WHEN demo.classification = 'PRIVATE' THEN 'DUMMY-APPROVED-TUITION-RECEIPT' ELSE NULL END,
      CASE WHEN demo.classification = 'PRIVATE' THEN 'approved' ELSE 'pending' END,
      'DUMMY-APPROVED-GRADES', 'approved', TRUE, CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (applicant_id, billing_period_id) DO UPDATE SET
      school_id = EXCLUDED.school_id,
      year_level = EXCLUDED.year_level,
      course = EXCLUDED.course,
      billing_amount = EXCLUDED.billing_amount,
      billing_notes = EXCLUDED.billing_notes,
      billing_school_year = EXCLUDED.billing_school_year,
      billing_semester = EXCLUDED.billing_semester,
      billing_status = CASE
        WHEN scholar_requirements.billing_reference IS NULL THEN 'Ready for billing'
        ELSE scholar_requirements.billing_status
      END,
      cert_tax_exemption_file = EXCLUDED.cert_tax_exemption_file,
      cert_tax_exemption_review_status = 'approved',
      barangay_indigency_file = EXCLUDED.barangay_indigency_file,
      barangay_indigency_review_status = 'approved',
      valid_id_photocopy_file = EXCLUDED.valid_id_photocopy_file,
      valid_id_photocopy_review_status = 'approved',
      registration_form_file = EXCLUDED.registration_form_file,
      registration_form_review_status = 'approved',
      tuition_fee_receipt_file = EXCLUDED.tuition_fee_receipt_file,
      tuition_fee_receipt_review_status = EXCLUDED.tuition_fee_receipt_review_status,
      grade_report_file = EXCLUDED.grade_report_file,
      grade_report_review_status = 'approved',
      folder_physical_submitted = TRUE,
      folder_physical_submitted_at = COALESCE(
        scholar_requirements.folder_physical_submitted_at,
        CURRENT_TIMESTAMP
      ),
      updated_at = CURRENT_TIMESTAMP;
  END LOOP;
END $$;
