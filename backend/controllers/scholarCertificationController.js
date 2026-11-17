const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { hasSectionAccess } = require('../services/sectionAccess');
const { validateDocumentUpload: validatePdf } = require('../services/documentFilePolicy');
const storage = require('../services/blobStorage');
const { failure, positiveId, metadataSelect, serialize, loadContext, findExisting, prepareTicket, verifyTicket, matchContext } = require('../services/scholarCertification');

function createScholarCertificationController({ prisma, validateDocumentUpload = validatePdf, uploadDataUrl = storage.uploadDataUrl,
  deleteBlob = storage.deleteBlob, blobGet = async (...args) => (await import('@vercel/blob')).get(...args),
  getSecret = () => process.env.JWT_SECRET, getStorageToken = () => process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN, now = () => new Date() }) {
  const safe = handler => async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      if (!req.user) throw failure('Authentication required.', 401);
      if (!['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin'].includes(req.user.role) || !hasSectionAccess(req.user, 'scholars')) throw failure('Scholar section access is required.', 403);
      positiveId(req.user.id);
      if (!prisma.scholar_certifications) throw failure('Certification history is temporarily unavailable. Please retry after the system update.', 503);
      return await handler(req, res);
    } catch (error) {
      if (res.headersSent) return res.end();
      const status = error.statusCode || (error.code === 'P2034' ? 409 : ['P2021', 'P2022'].includes(error.code) ? 503 : 500);
      return res.status(status).json({ message: status === 500 ? 'Unable to save or open the certification. Please retry.' : status === 503 && !error.statusCode ? 'Certification history is temporarily unavailable.' : status === 409 && !error.statusCode ? 'Scholar records changed while saving. Prepare the certification again.' : error.message });
    }
  };
  const index = safe(async (req, res) => {
    const applicantId = positiveId(req.params.applicantId);
    const records = await prisma.scholar_certifications.findMany({ where: { applicant_id: applicantId }, select: metadataSelect, orderBy: [{ generated_at: 'desc' }, { id: 'desc' }] });
    return res.json({ certifications: records.map(serialize) });
  });
  const prepare = safe(async (req, res) => {
    const context = await loadContext(prisma, positiveId(req.params.applicantId), positiveId(req.body?.academicPeriodId));
    const existing = await findExisting(prisma, context);
    const generatedAt = new Date(existing ? existing.generated_at : now()).toISOString();
    return res.json({ snapshot: context.snapshot, generatedAt, generationToken: existing ? null : prepareTicket(context, req.user, generatedAt, getSecret()), existingCertification: serialize(existing) });
  });
  const save = safe(async (req, res) => {
    const applicantId = positiveId(req.params.applicantId), periodId = positiveId(req.body?.academicPeriodId);
    const ticket = verifyTicket(req.body?.generationToken, req.user, applicantId, periodId, now(), getSecret());
    const context = await loadContext(prisma, applicantId, periodId);
    matchContext(context, ticket);
    const prior = await findExisting(prisma, context);
    if (prior) {
      res.locals ||= {}; res.locals.auditSkip = true;
      return res.json({ certification: serialize(prior), reused: true });
    }
    const fileName = `${context.snapshot.reference}.pdf`;
    const parsed = await validateDocumentUpload(fileName, req.body?.fileData);
    if (parsed.contentType !== 'application/pdf') throw failure('A generated PDF certification is required.');
    const token = getStorageToken();
    let file = { file_name: fileName, file_type: 'application/pdf', file_data: req.body.fileData, file_url: null, file_pathname: null, storage: 'database' };
    if (token) {
      const blob = await uploadDataUrl({ dataUrl: req.body.fileData, fileName, contentType: 'application/pdf', pathSegments: ['scholar-certifications', applicantId, periodId, context.snapshotHash], token, access: 'private' });
      file = { ...file, file_data: null, file_url: blob.url, file_pathname: blob.pathname, storage: 'vercel-blob-private' };
    } else if (process.env.NODE_ENV === 'production') throw failure('Private document storage is not configured.', 503);
    let retained = false;
    try {
      let result;
      try {
        result = await prisma.$transaction(async tx => {
          const current = await loadContext(tx, applicantId, periodId);
          matchContext(current, ticket);
          const existing = await findExisting(tx, current);
          if (existing) return { record: existing, created: false };
          const record = await tx.scholar_certifications.create({ data: {
            applicant_id: applicantId, scholar_account_id: context.scholarId, academic_period_id: periodId,
            reference_number: context.snapshot.reference, snapshot_hash: context.snapshotHash, template_version: context.snapshot.templateVersion,
            snapshot: context.snapshot, generated_at: new Date(ticket.generatedAt), generated_by: req.user.id, generated_by_role: req.user.role, ...file,
          }, select: metadataSelect });
          return { record, created: true };
        }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        const existing = await findExisting(prisma, context);
        if (!existing) throw error;
        result = { record: existing, created: false };
      }
      retained = result.created;
      if (result.created) {
        res.locals ||= {}; res.locals.auditTargetId = result.record.id;
        res.locals.auditDescription = `Generated an individual Scholar certification for academic period ${periodId}.`;
      } else { res.locals ||= {}; res.locals.auditSkip = true; }
      return res.status(result.created ? 201 : 200).json({ certification: serialize(result.record), reused: !result.created });
    } finally { if (file.file_url && !retained) await deleteBlob(file.file_url, token); }
  });
  const file = safe(async (req, res) => {
    const record = await prisma.scholar_certifications.findFirst({ where: { id: positiveId(req.params.certificationId), applicant_id: positiveId(req.params.applicantId) }, select: { file_name: true, file_type: true, file_data: true, file_url: true } });
    if (!record) throw failure('Certification not found.', 404);
    const headers = () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${String(record.file_name).replace(/[^\x20-\x7e]|["\\]/g, '_')}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
    };
    if (record.file_data) { const parsed = storage.parseDataUrl(record.file_data); headers(); return res.send(parsed.buffer); }
    if (!record.file_url) throw failure('Certification content is unavailable.', 404);
    const token = getStorageToken();
    if (!token) throw failure('Private document storage is not configured.', 503);
    const result = await blobGet(record.file_url, { access: 'private', token });
    if (!result?.stream) throw failure('Certification content is unavailable.', 404);
    headers();
    await pipeline(Readable.fromWeb(result.stream), res);
  });
  return { index, prepare, save, file };
}
module.exports = { createScholarCertificationController };
