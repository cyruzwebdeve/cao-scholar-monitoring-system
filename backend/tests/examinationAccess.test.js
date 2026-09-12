const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canAccessOnlineExamination,
  getExaminationSettings,
  isExaminationScheduleOpen,
  resolveExaminationSettings,
} = require('../services/examinationAccess');

test('examination access defaults to inactive paper delivery', () => {
  assert.deepEqual(resolveExaminationSettings(null), {
    isEnabled: false,
    deliveryMode: 'paper',
    updatedAt: null,
  });
});

test('only the persisted online value enables online delivery', () => {
  assert.equal(resolveExaminationSettings({ examination_enabled: true, exam_delivery_mode: 'online' }).deliveryMode, 'online');
  assert.equal(resolveExaminationSettings({ examination_enabled: true, exam_delivery_mode: 'unexpected' }).deliveryMode, 'paper');
});

test('question access is limited to an active examination schedule window', () => {
  const exam = {
    is_active: true,
    exam_date: new Date('2026-09-12T00:00:00.000Z'),
    exam_end_date: new Date('2026-09-13T00:00:00.000Z'),
  };
  assert.equal(isExaminationScheduleOpen(exam, new Date('2026-09-11T01:00:00.000Z')), false);
  assert.equal(isExaminationScheduleOpen(exam, new Date('2026-09-12T02:00:00.000Z')), true);
  assert.equal(isExaminationScheduleOpen(exam, new Date('2026-09-14T02:00:00.000Z')), false);
  assert.equal(isExaminationScheduleOpen({ ...exam, is_active: false }, new Date('2026-09-12T02:00:00.000Z')), false);
});

test('online question access additionally requires confirmed attendance', () => {
  const exam = {
    is_active: true,
    exam_date: new Date('2026-09-12T00:00:00.000Z'),
    exam_end_date: new Date('2026-09-13T00:00:00.000Z'),
  };
  const settings = { isEnabled: true, deliveryMode: 'online' };
  const now = new Date('2026-09-12T02:00:00.000Z');
  assert.equal(canAccessOnlineExamination({ settings, exam, examSlot: { appeared: false }, now }), false);
  assert.equal(canAccessOnlineExamination({ settings, exam, examSlot: { appeared: true }, now }), true);
  assert.equal(canAccessOnlineExamination({ completed: true, settings, exam, examSlot: { appeared: true }, now }), false);
});

test('examination settings are loaded from the singleton record', async () => {
  const result = await getExaminationSettings({ application_settings: { findUnique: async () => ({ examination_enabled: true, exam_delivery_mode: 'online' }) } });
  assert.equal(result.isEnabled, true);
  assert.equal(result.deliveryMode, 'online');
});
