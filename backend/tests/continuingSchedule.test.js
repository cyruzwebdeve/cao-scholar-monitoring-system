const test = require('node:test');
const assert = require('node:assert/strict');
const { initialApproved, evaluateContinuingSchedule, projectContinuingAccess } = require('../services/continuingSchedule');
const { evaluateListEligibility } = require('../services/lifecycleIntegrity');
const { getEffectiveRequirements } = require('../services/requirementWaves');
const period = { id: 10, requirements_deadline: '2026-10-15T00:00:00Z' };
const schedule = { opens_at: '2026-10-01T00:00:00Z', closes_at: '2026-10-10T00:00:00Z', late_opens_at: '2026-10-12T00:00:00Z', late_closes_at: '2026-10-20T00:00:00Z', late_scope: 'selected', late_applicant_ids: [7] };
const docs = { requirements: Object.fromEntries(['tax_exemption','indigency','valid_id','grades','registration_form'].map((key) => [key, { fileName: `${key}.pdf`, status: 'Approved' }])) };
const access = (now, extra = {}) => evaluateContinuingSchedule({ schedule, period, docs, applicantId: 7, schoolType: 'Public', now, ...extra });
test('Public needs five approved initial documents; Private also needs tuition receipt; unknown type fails closed', () => {
 assert.equal(initialApproved(docs, 10, 'Public'), true); assert.equal(initialApproved(docs, 10, 'Private'), false); assert.equal(initialApproved(docs, 10, 'Unknown'), false);
 assert.equal(initialApproved({ requirements: { ...docs.requirements, tuition_receipt: { fileName: 'receipt.pdf', status: 'Approved' } } }, 10, 'Private'), true);
});
test('Missing or pending initial documents keep scheduled uploads closed', () => {
 assert.equal(access('2026-10-05', { docs: {} }).state, 'waiting_initial');
 assert.equal(access('2026-10-05', { docs: { requirements: { ...docs.requirements, grades: { fileName: 'grades.pdf', status: 'Pending' } } } }).isOpen, false);
});
test('Approved scholar automatically opens at regular start without manual flag', () => {
 assert.equal(access('2026-09-30').isOpen, false); assert.equal(access(schedule.opens_at).isOpen, true); assert.equal(access(schedule.closes_at).isOpen, true); assert.equal(access('2026-10-10T00:00:00.001Z').isOpen, false);
});
test('Selected late scholar opens in original period and preserves regular deadline', () => {
 const result = access('2026-10-14'); assert.equal(result.state, 'late_open'); assert.equal(result.isOpen, true); assert.equal(result.regularDeadline, new Date(schedule.closes_at).toISOString()); assert.equal(result.deadline, new Date(schedule.late_closes_at).toISOString());
});
test('Unselected scholars cannot use late window; no late dates leak', () => {
 const result = access('2026-10-14', { applicantId: 8 }); assert.equal(result.isOpen, false); assert.equal(result.lateOpensAt, null);
});
test('All-scholar late scope admits other eligible scholar', () => { assert.equal(access('2026-10-14', { applicantId: 8, schedule: { ...schedule, late_scope: 'all' } }).isOpen, true); });
test('Late opening and deadline boundaries are enforced', () => { assert.equal(access('2026-10-11').state, 'late_scheduled'); assert.equal(access(schedule.late_opens_at).isOpen, true); assert.equal(access(schedule.late_closes_at).isOpen, true); assert.equal(access('2026-10-20T00:00:00.001Z').state, 'closed'); });
test('Projection preserves originals without mutating source; continuing stays visible after deadline', () => {
 const copy = JSON.stringify(docs); const result = projectContinuingAccess(docs, 10, access('2026-10-21')); assert.equal(JSON.stringify(docs), copy); assert.ok(result.requirementWaves[10].continuingOpenedAt); assert.equal(getEffectiveRequirements(result, 10).requirements.grades, undefined);
});
test('Expired uploads never block payroll eligibility but duplicate list membership still does', () => {
 const options = { isActive: true, schoolType: 'Public', requireSchoolClassification: true, initialDocs: getEffectiveRequirements(projectContinuingAccess(docs, 10, access('2026-10-21')), 10) };
 assert.equal(evaluateListEligibility(options).eligible, true); assert.equal(evaluateListEligibility(options).warnings.length, 2); assert.equal(evaluateListEligibility({ ...options, alreadyProcessedForPeriod: true }).eligible, false);
});
test('Unconfigured periods retain manual wave/deadline compatibility', () => {
 assert.equal(access('2026-10-05', { schedule: null }).isOpen, false); assert.equal(access('2026-10-05', { schedule: null, docs: { ...docs, requirementWaves: { 10: { continuingOpenedAt: '2026-10-01' } } } }).isOpen, true);
});
