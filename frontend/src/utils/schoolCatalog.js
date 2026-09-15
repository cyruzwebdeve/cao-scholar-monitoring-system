// Classifications come from the saved server catalog, never a client-side default.
export const formatSchoolClassification = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'public' ? 'Public' : normalized === 'private' ? 'Private' : 'Unclassified';
};

export const savedSchoolCatalog = (schools = []) => schools
  .map((school) => ({ ...school, classification: formatSchoolClassification(school.classification) }))
  .sort((left, right) => left.name.localeCompare(right.name));
