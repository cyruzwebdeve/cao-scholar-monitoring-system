const HONORS = Object.freeze({ none: 'No Latin honors', cum_laude: 'Cum Laude', magna_cum_laude: 'Magna Cum Laude', summa_cum_laude: 'Summa Cum Laude' });
const failure = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const metadataSelect = Object.fromEntries(['applicant_id', 'graduation_date', 'academic_year', 'latin_honor', 'school', 'course', 'proof_name', 'review_status', 'review_notes', 'reviewed_at', 'updated_at', 'version'].map(key => [key, true]));
function validateGraduation(body, now = new Date()) {
  const version = body.expectedVersion;
  if (!Number.isSafeInteger(version) || version < 0) throw failure('Reload the graduation record before saving.');
  const date = body.graduationDate;
  const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < '1900-01-01' || date > today) throw failure('Enter an actual graduation date, today or earlier.');
  const year = body.academicYear;
  if (typeof year !== 'string' || !/^\d{4}-\d{4}$/.test(year) || Number(year.slice(5)) !== Number(year.slice(0, 4)) + 1 || Number(year.slice(0, 4)) < 1900 || Number(year.slice(0, 4)) > Number(date.slice(0, 4)) || Number(date.slice(0, 4)) - Number(year.slice(5)) > 1) throw failure('Enter the graduation academic year as consecutive years matching the graduation date.');
  if (typeof body.latinHonor !== 'string' || !Object.hasOwn(HONORS, body.latinHonor)) throw failure('Select a valid Latin honor or No Latin honors.');
  const text = key => {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > 200 || /[\x00-\x1f]/.test(body[key])) throw failure(`Enter a valid ${key} (maximum 200 characters).`);
    return body[key].trim();
  };
  return { graduation_date: parsed, academic_year: year, latin_honor: body.latinHonor, school: text('school'), course: text('course') };
}
function validateReview(body) {
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) throw failure('Reload the graduation record before reviewing.');
  if (!['verified', 'rejected'].includes(body.decision)) throw failure('Choose Verify or Return for correction.');
  const notes = body.notes == null ? '' : body.notes;
  if (typeof notes !== 'string' || notes.trim().length > 1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(notes)) throw failure('Use review notes of at most 1000 characters.');
  if (body.decision === 'verified' && body.proofReviewed !== true) throw failure('Confirm that you checked the supporting proof.');
  if (body.decision === 'rejected' && !notes.trim()) throw failure('Explain what the Scholar needs to correct.');
  return { review_status: body.decision, review_notes: notes.trim() || null };
}
function serialize(row) {
  return row ? { applicantId: row.applicant_id, graduationDate: row.graduation_date.toISOString().slice(0, 10), academicYear: row.academic_year, latinHonor: row.latin_honor, honorLabel: HONORS[row.latin_honor], school: row.school, course: row.course, proofName: row.proof_name, reviewStatus: row.review_status, reviewNotes: row.review_notes, reviewedAt: row.reviewed_at, updatedAt: row.updated_at, version: row.version } : null;
}
module.exports = { HONORS, failure, metadataSelect, validateGraduation, validateReview, serialize };
