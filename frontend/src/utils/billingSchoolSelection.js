export const SAVED_SCHOOL_VALUE = 'saved-scholar-school';
const normalizeName = (name) => typeof name === 'string'
  ? name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
  : '';

export const billingSchoolSelection = (record, catalog) => {
  const savedName = typeof record.school === 'string' ? record.school.trim() : '';
  const existing = catalog.find((school) => record.schoolId && String(school.id) === String(record.schoolId))
    || catalog.find((school) => normalizeName(school.name) === normalizeName(savedName));
  if (existing && ['Public', 'Private'].includes(existing.schoolType)) return { schoolId: String(existing.id), schoolClassification: existing.schoolType };
  const hasSavedSchool = savedName && !['not specified', 'not available'].includes(normalizeName(savedName));
  return {
    schoolId: hasSavedSchool ? SAVED_SCHOOL_VALUE : '',
    schoolClassification: ['Public', 'Private'].includes(record.schoolType) ? record.schoolType : '',
  };
};

export const resolveBillingSchoolId = async (selection, record, registerSchool) => {
  if (selection.schoolId !== SAVED_SCHOOL_VALUE) {
    const id = Number(selection.schoolId);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Select a valid school.');
    return id;
  }
  if (!['Public', 'Private'].includes(selection.schoolClassification)) {
    throw new Error('Confirm whether the saved school is Public or Private. The existing school name will be reused.');
  }
  const result = await registerSchool({ name: record.school, classification: selection.schoolClassification.toLowerCase() });
  const id = Number(result.school?.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('The saved school could not be linked. Refresh and try again.');
  return id;
};
