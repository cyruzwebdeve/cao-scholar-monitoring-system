const certificationCreatedAt = (schoolType, batch) => {
  if (String(schoolType || '').trim().toLowerCase() !== 'private') return null;
  const isCertification = String(batch?.batch_number || '').startsWith('BILL-')
    || String(batch?.status || '').toLowerCase() === 'billed';
  if (!isCertification || !batch?.prepared_at) return null;
  const date = new Date(batch.prepared_at);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const latestCertificationCreatedAt = async (client, applicantId, schoolType) => {
  if (!applicantId || String(schoolType || '').trim().toLowerCase() !== 'private') return null;
  const claims = await client.payroll_claims.findMany({
    where: { applicant_id: applicantId },
    select: { payroll_batch_id: true },
  });
  const batchIds = [...new Set(claims.map((claim) => claim.payroll_batch_id).filter(Boolean))];
  if (!batchIds.length) return null;
  const batches = await client.payroll_batches.findMany({
    where: {
      id: { in: batchIds },
      OR: [{ batch_number: { startsWith: 'BILL-' } }, { status: 'billed' }],
    },
    select: { batch_number: true, status: true, prepared_at: true },
  });
  return batches.reduce((latest, batch) => {
    const date = certificationCreatedAt(schoolType, batch);
    return date && (!latest || date > latest) ? date : latest;
  }, null);
};

module.exports = { certificationCreatedAt, latestCertificationCreatedAt };
