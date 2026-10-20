const { failure, metadataSelect, validateGraduation, validateReview, serialize } = require('../services/scholarGraduation');
function createGraduationController({ prisma, validateDocumentUpload }) {
  const idFor = req => {
    const id = req.user.role === 'Scholar' ? req.user.id : Number(req.params.applicantId);
    if (!Number.isSafeInteger(id) || id < 1) throw failure('Scholar not found.', 404);
    return id;
  };
  const ensureScholar = async (db, id) => {
    const [scholar, applicant] = await Promise.all([db.scholar_accounts.findUnique({ where: { applicant_id: id } }), db.applicants.findFirst({ where: { id, deleted_at: null } })]);
    if (!scholar || !applicant) throw failure('Scholar not found.', 404);
    return applicant;
  };
  const safe = handler => async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { return await handler(req, res); }
    catch (error) {
      const conflict = ['P2002', 'P2034'].includes(error.code);
      const status = conflict ? 409 : error.statusCode || 500;
      return res.status(status).json({ message: conflict ? 'This graduation record changed. Reload it before continuing.' : status === 500 ? 'Unable to access graduation records. Please retry.' : error.message });
    }
  };
  const read = safe(async (req, res) => {
    const id = idFor(req); await ensureScholar(prisma, id);
    res.json({ graduation: serialize(await prisma.scholar_graduations.findUnique({ where: { applicant_id: id }, select: metadataSelect })) });
  });
  const save = safe(async (req, res) => {
    const id = idFor(req), body = req.body || {};
    const fields = validateGraduation(body);
    await ensureScholar(prisma, id);
    let proof = null;
    if (body.fileName != null || body.fileData != null) {
      const parsed = await validateDocumentUpload(body.fileName, body.fileData);
      proof = { proof_name: body.fileName.trim(), proof_type: parsed.contentType, proof_data: parsed.buffer };
    }
    const graduation = await prisma.$transaction(async tx => {
      await ensureScholar(tx, id);
      const current = await tx.scholar_graduations.findUnique({ where: { applicant_id: id }, select: metadataSelect });
      if ((current?.version || 0) !== body.expectedVersion) throw failure('This graduation record changed. Reload it before continuing.', 409);
      if (!current && !proof) throw failure('Attach proof of graduation and Latin honors, if applicable.');
      const data = { ...fields, ...proof, review_status: 'pending', review_notes: null, reviewed_at: null, reviewed_by: null };
      if (current) {
        const updated = await tx.scholar_graduations.updateMany({ where: { applicant_id: id, version: body.expectedVersion }, data: { ...data, version: { increment: 1 } } });
        if (updated.count !== 1) throw failure('This graduation record changed. Reload it before continuing.', 409);
      } else await tx.scholar_graduations.create({ data: { applicant_id: id, ...data } });
      return serialize(await tx.scholar_graduations.findUnique({ where: { applicant_id: id }, select: metadataSelect }));
    }, { isolationLevel: 'Serializable' });
    res.locals ||= {}; res.locals.auditTargetId = id;
    res.json({ graduation, message: 'Graduation record submitted for staff verification.' });
  });
  const review = safe(async (req, res) => {
    const id = idFor(req), body = req.body || {}, decision = validateReview(body);
    const graduation = await prisma.$transaction(async tx => {
      await ensureScholar(tx, id);
      const result = await tx.scholar_graduations.updateMany({ where: { applicant_id: id, version: body.expectedVersion, review_status: 'pending' }, data: { ...decision, reviewed_by: req.user.id, reviewed_at: new Date(), version: { increment: 1 } } });
      if (result.count !== 1) throw failure('This record was changed or already reviewed. Reload it before reviewing.', 409);
      return serialize(await tx.scholar_graduations.findUnique({ where: { applicant_id: id }, select: metadataSelect }));
    }, { isolationLevel: 'Serializable' });
    res.locals ||= {}; res.locals.auditTargetId = id;
    res.json({ graduation });
  });
  const file = safe(async (req, res) => {
    const id = idFor(req); await ensureScholar(prisma, id);
    const record = await prisma.scholar_graduations.findUnique({ where: { applicant_id: id }, select: { proof_data: true, proof_type: true } });
    if (!record) throw failure('No graduation proof has been submitted.', 404);
    res.set('Content-Type', record.proof_type);
    res.set('Content-Disposition', 'attachment; filename="graduation-proof"');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(record.proof_data));
  });
  const index = safe(async (req, res) => {
    if (req.query.q != null && typeof req.query.q !== 'string') throw failure('Enter a text search.');
    const q = String(req.query.q || '').trim();
    if (q.length > 100) throw failure('Search must be at most 100 characters.');
    const status = req.query.status || 'verified', honor = req.query.honor || 'honors';
    if (!['all', 'pending', 'verified', 'rejected'].includes(status) || !['all', 'honors', 'none', 'cum_laude', 'magna_cum_laude', 'summa_cum_laude'].includes(honor)) throw failure('Select valid graduation filters.');
    const page = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw failure('Select a valid page.');
    const year = req.query.year || '';
    if (typeof year !== 'string' || year && !/^\d{4}-\d{4}$/.test(year)) throw failure('Use a graduation academic year such as 2025-2026.');
    // Search current names plus the recorded graduation school/course, with no proof bytes in list responses.
    const visibleApplicants = await prisma.applicants.findMany({ where: { deleted_at: null }, select: { id: true, first_name: true, middle_name: true, last_name: true } });
    const tokens = q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const nameMatches = visibleApplicants.filter(person => tokens.every(token => [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ').toLocaleLowerCase().includes(token)));
    const where = { applicant_id: { in: visibleApplicants.map(row => row.id) }, ...(status !== 'all' && { review_status: status }), ...(year && { academic_year: year }), ...(honor === 'honors' ? { latin_honor: { not: 'none' } } : honor !== 'all' ? { latin_honor: honor } : {}), ...(q && { OR: [{ applicant_id: { in: nameMatches.map(row => row.id) } }, ...['school', 'course'].map(key => ({ [key]: { contains: q, mode: 'insensitive' } }))] }) };
    const [records, total] = await prisma.$transaction([
      prisma.scholar_graduations.findMany({ where, select: metadataSelect, orderBy: [{ graduation_date: 'desc' }, { applicant_id: 'asc' }], take: 25, skip: (page - 1) * 25 }),
      prisma.scholar_graduations.count({ where }),
    ]);
    const ids = records.map(row => row.applicant_id);
    const [people, scholars] = await Promise.all([
      prisma.applicants.findMany({ where: { id: { in: ids }, deleted_at: null }, select: { id: true, first_name: true, middle_name: true, last_name: true } }),
      prisma.scholar_accounts.findMany({ where: { applicant_id: { in: ids } }, select: { applicant_id: true, scholar_id: true } }),
    ]);
    const names = new Map(people.map(person => [person.id, [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')]));
    res.json({ records: records.filter(row => names.has(row.applicant_id)).map(row => ({ ...serialize(row), name: names.get(row.applicant_id), scholarId: scholars.find(scholar => scholar.applicant_id === row.applicant_id)?.scholar_id })), total, page, pageSize: 25 });
  });
  return { read, save, review, file, index };
}
module.exports = { createGraduationController };
