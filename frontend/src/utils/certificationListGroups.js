// Payroll represents one official batch across schools. Billing letters are
// addressed to one school, so their existing grouping remains school-specific.
export function certificationListGroups(records, mode) {
  if (!['billing', 'payroll'].includes(mode)) throw new Error('Invalid list type.');
  if (!records?.length) throw new Error('A scholar list is required.');
  if (mode === 'payroll') return [{ scholars: records }];
  const schools = new Map();
  records.forEach(record => {
    const school = String(record.school || '').trim();
    if (!school) throw new Error('A listed scholar has no school. Correct the school record before downloading.');
    if (!schools.has(school)) schools.set(school, []);
    schools.get(school).push(record);
  });
  return [...schools].map(([school, scholars]) => ({ school, scholars }));
}
