import { formatSchoolClassification } from './schoolCatalog.js';
export const SAVED_SCHOOL_VALUE = 'saved-scholar-school';
const normalizeName = (name) => typeof name === 'string'
  ? name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
  : '';

export const billingSchoolSelection = (record, catalog) => {
  const savedName = typeof record.school === 'string' ? record.school.trim() : '';
  const existing = catalog.find((school) => record.schoolId && String(school.id) === String(record.schoolId))
    || catalog.find((school) => normalizeName(school.name) === normalizeName(savedName));
  if (existing) return { schoolId: String(existing.id), schoolClassification: formatSchoolClassification(existing.schoolType) };
  const hasSavedSchool = savedName && !['not specified', 'not available'].includes(normalizeName(savedName));
  return {
    schoolId: hasSavedSchool ? SAVED_SCHOOL_VALUE : '',
    schoolClassification: 'Unclassified',
  };
};

export const resolveBillingSchoolId = async (selection) => {
  if (selection.schoolId === SAVED_SCHOOL_VALUE) {
    throw new Error('This saved school is not in School Catalog. Ask the Super Administrator to save its classification there, then refresh.');
  }
  if (selection.schoolClassification === 'Unclassified') {
    throw new Error('Save this school\'s Public or Private classification in School Catalog first, then refresh.');
  }
  const id = Number(selection.schoolId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Select a valid school.');
  return id;
};
