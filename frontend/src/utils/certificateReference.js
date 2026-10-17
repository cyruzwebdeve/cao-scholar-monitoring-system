// The individual PDF uses one stable scholar reference across academic periods.
export const certificateReferenceFor = (record) => {
  if (!Number.isSafeInteger(record?.id) || record.id <= 0) {
    throw new Error('Refresh the scholar record before downloading certification.');
  }
  return `PGCEAP-CERT#${String(record.id).padStart(4, '0')}`;
};
