const certificationCreatedAt = (schoolType, batch) => {
  if (String(schoolType || '').trim().toLowerCase() !== 'private') return null;
  const isCertification = String(batch?.batch_number || '').startsWith('BILL-')
    || String(batch?.status || '').toLowerCase() === 'billed';
  if (!isCertification || !batch?.prepared_at) return null;
  const date = new Date(batch.prepared_at);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

module.exports = { certificationCreatedAt };
