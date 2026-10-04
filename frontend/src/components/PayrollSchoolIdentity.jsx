import { formatSchoolClassification } from '../utils/schoolCatalog';

export default function PayrollSchoolIdentity({ record }) {
  const school = record.school?.trim();
  const hasSchool = Boolean(school && school !== 'Not specified');
  const classification = formatSchoolClassification(record.schoolType);
  const identified = hasSchool && Boolean(record.schoolId) && classification !== 'Unclassified';

  return (
    <div className="payroll-school-identity" aria-label={`Recorded school for ${record.name}`}>
      <strong>{hasSchool ? school : 'No school recorded'}</strong>
      <span>{identified ? `Auto-identified · ${classification}` : 'School identification incomplete'}</span>
      {!identified && <span>Ask an administrator to correct the scholar record or School Catalog. Payroll cannot proceed until the school is identified and classified.</span>}
    </div>
  );
}
