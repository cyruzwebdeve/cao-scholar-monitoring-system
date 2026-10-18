// PSGC codes keep identically named barangays in different municipalities distinct.
export const getReportBarangayOptions = (barangays, municipalityCode) => municipalityCode
  ? barangays.filter(barangay => barangay.municipalityCode === municipalityCode).slice().sort((a, b) => a.name.localeCompare(b.name))
  : [];

export const matchesReportLocation = (row, municipalityCode = '', barangayCode = '') => (
  (!municipalityCode || row.municipalityCode === municipalityCode)
  && (!barangayCode || (row.type === 'Barangay' && row.id === barangayCode))
);

// Province-wide view summarizes municipalities; choosing one reveals its barangays.
export const getReportLocationLevel = municipalityCode => municipalityCode ? 'barangay' : 'municipality';
