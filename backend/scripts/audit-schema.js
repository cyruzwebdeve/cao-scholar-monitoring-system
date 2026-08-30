const prisma = require('../config/prisma');

const LOGICAL_RELATIONSHIPS = [
  ['academic_periods', 'created_by', 'admins', 'id'],
  ['announcements', 'created_by', 'admins', 'id'],
  ['applicants', 'school_id', 'schools', 'id'],
  ['application_submissions', 'applicant_id', 'applicants', 'id'],
  ['control_accounts', 'applicant_id', 'applicants', 'id'],
  ['exam_slots', 'applicant_id', 'applicants', 'id'],
  ['exam_slots', 'exam_id', 'exams', 'id'],
  ['results', 'exam_slot_id', 'exam_slots', 'id'],
  ['results', 'applicant_id', 'applicants', 'id'],
  ['results', 'exam_id', 'exams', 'id'],
  ['results', 'recorded_by', 'admins', 'id'],
  ['eligibility_assessments', 'applicant_id', 'applicants', 'id'],
  ['eligibility_assessments', 'application_id', 'application_submissions', 'id'],
  ['eligibility_assessments', 'result_id', 'results', 'id'],
  ['eligibility_assessments', 'academic_period_id', 'academic_periods', 'id'],
  ['eligibility_assessments', 'reviewed_by', 'admins', 'id'],
  ['scholar_accounts', 'applicant_id', 'applicants', 'id'],
  ['scholar_accounts', 'result_id', 'results', 'id'],
  ['scholar_accounts', 'issued_by', 'admins', 'id'],
  ['scholar_requirements', 'applicant_id', 'applicants', 'id'],
  ['scholar_requirements', 'billing_period_id', 'academic_periods', 'id'],
  ['scholar_requirements', 'school_id', 'schools', 'id'],
  ['scholar_requirements', 'updated_by', 'admins', 'id'],
  ['payroll_batches', 'billing_period_id', 'academic_periods', 'id'],
  ['payroll_batches', 'prepared_by', 'admins', 'id'],
  ['payroll_batches', 'released_by', 'admins', 'id'],
  ['payroll_claims', 'payroll_batch_id', 'payroll_batches', 'id'],
  ['payroll_claims', 'applicant_id', 'applicants', 'id'],
];

const UNIQUE_CANDIDATES = [
  ['admins', ['email']],
  ['applicants', ['email']],
  ['control_accounts', ['applicant_id']],
  ['control_accounts', ['control_number']],
  ['control_accounts', ['username']],
  ['exam_slots', ['applicant_id', 'exam_id']],
  ['results', ['exam_slot_id']],
  ['scholar_accounts', ['applicant_id']],
  ['scholar_accounts', ['scholar_id']],
  ['scholar_requirements', ['applicant_id', 'billing_period_id']],
  ['schools', ['name']],
  ['payroll_batches', ['batch_number']],
  ['payroll_claims', ['payroll_batch_id', 'applicant_id']],
];

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

const main = async () => {
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `;
  const tables = [...new Set(columns.map(({ table_name: tableName }) => tableName))];

  console.log('\nTABLE AND COLUMN USAGE');
  for (const table of tables) {
    const tableColumns = columns.filter(({ table_name: tableName }) => tableName === table);
    const stats = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS "rows", ${tableColumns.map(({ column_name: column }) => `COUNT(${quoteIdentifier(column)})::int AS ${quoteIdentifier(column)}`).join(', ')} FROM ${quoteIdentifier(table)}`,
    );
    const [row] = stats;
    const neverPopulated = tableColumns
      .map(({ column_name: column }) => column)
      .filter((column) => row.rows > 0 && row[column] === 0);
    console.log(`${table}: ${row.rows} rows${neverPopulated.length ? ` | always null: ${neverPopulated.join(', ')}` : ''}`);
  }

  console.log('\nLOGICAL RELATIONSHIP ORPHANS');
  for (const [sourceTable, sourceColumn, targetTable, targetColumn] of LOGICAL_RELATIONSHIPS) {
    const [result] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "orphans"
      FROM ${quoteIdentifier(sourceTable)} source
      LEFT JOIN ${quoteIdentifier(targetTable)} target
        ON source.${quoteIdentifier(sourceColumn)} = target.${quoteIdentifier(targetColumn)}
      WHERE source.${quoteIdentifier(sourceColumn)} IS NOT NULL
        AND target.${quoteIdentifier(targetColumn)} IS NULL
    `);
    console.log(`${sourceTable}.${sourceColumn} -> ${targetTable}.${targetColumn}: ${result.orphans}`);
  }

  console.log('\nUNIQUE-CONSTRAINT CANDIDATES');
  for (const [table, fields] of UNIQUE_CANDIDATES) {
    const identifiers = fields.map(quoteIdentifier).join(', ');
    const [result] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "duplicate_groups"
      FROM (
        SELECT ${identifiers}
        FROM ${quoteIdentifier(table)}
        WHERE ${fields.map((field) => `${quoteIdentifier(field)} IS NOT NULL`).join(' AND ')}
        GROUP BY ${identifiers}
        HAVING COUNT(*) > 1
      ) duplicates
    `);
    console.log(`${table}(${fields.join(', ')}): ${result.duplicate_groups} duplicate groups`);
  }
};

main()
  .catch((error) => {
    console.error('Schema audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
