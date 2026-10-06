export default function ScholarSchoolIdentity({ record }) {
  const school = record.school?.trim();
  const hasSchool = Boolean(school && school !== 'Not specified');

  return (
    <div className="processing-school-identity" aria-label={`Recorded school for ${record.name}`}>
      <strong>{hasSchool ? school : 'No school recorded'}</strong>
    </div>
  );
}
