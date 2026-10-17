const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const prisma = {};
const id = require.resolve('../config/prisma');
require.cache[id] = { id, filename: id, loaded: true, exports: prisma };
process.env.JWT_SECRET = randomBytes(32).toString('hex');

// Exercise real authentication, role/section middleware and routes. Stop at
// injected controller probes: no database writes, uploads or emails are possible.
const reached = [];
const probe = (name) => (req, res) => { reached.push(name); res.status(204).end(); };
const replaceHandlers = (path, names) => {
  const handlers = require(path);
  for (const name of names) handlers[name] = probe(name);
};
replaceHandlers('../controllers/applicationController', ['updateAcademicPeriodRequirementsDeadline', 'uploadScholarRequirementByAdmin', 'openContinuingRequirements', 'getSchoolCatalog']);
replaceHandlers('../controllers/applicationSettingsController', ['updateApplicationSettings', 'updateExaminationSettings']);
replaceHandlers('../controllers/phoneCaptureController', ['create', 'get', 'send', 'freeze', 'acknowledge', 'close']);
replaceHandlers('../controllers/passerListController', ['create', 'post', 'intake']);
replaceHandlers('../controllers/continuingScheduleController', ['saveContinuingSchedule']);
replaceHandlers('../controllers/staffController', ['getStaffManagement', 'createStaffAccount', 'updateStaffAccount', 'changeStaffPassword']);
replaceHandlers('../controllers/activityController', ['getActivityLogs']);
const online = require('../controllers/onlineExamConfigurationController').onlineExamConfigurationController;
online.get = probe('questions-get'); online.save = probe('questions-save');
const router = require('../routes/applicationRoutes');
let server, base;
let sectionAccess;
prisma.admins = { findUnique: async ({ where }) => ({ id: where.id, role: 'billing', is_super_admin: false, is_active: true, auth_version: 0, section_access: sectionAccess }) };
prisma.activity_logs = { create: async () => ({}) };
before(async () => {
  const app = express(); app.use(express.json()); app.use(router);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
const request = async (method, path, withAuth = true) => {
  const token = jwt.sign({ userId: 99, accountType: 'admin', authVersion: 0 }, process.env.JWT_SECRET);
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(withAuth ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === 'GET' ? {} : { body: '{}' }) });
};
const operational = [
  ['PUT', '/application-settings', 'settings'], ['PUT', '/examination-settings', 'settings'],
  ['PUT', '/academic-periods/1/requirements-deadline', 'settings'],
  ['PUT', '/scholars/continuing-schedules/1', 'scholars'],
  ['PUT', '/scholars/1/continuing-requirements/open', 'scholars'],
  ['PUT', '/scholars/1/requirements/valid_id', 'scholars'],
  ['POST', '/passer-lists', 'examination'], ['POST', '/passer-lists/1/post', 'examination'],
  ['GET', '/passers/1/intake', 'examination'], ['PUT', '/passers/1/requirements/valid_id', 'examination'],
  ['POST', '/phone-capture/sessions', 'scholars'], ['GET', '/phone-capture/sessions/test', 'examination'],
  ['POST', '/phone-capture/sessions/test/pages', 'scholars'], ['POST', '/phone-capture/sessions/test/freeze', 'scholars'],
  ['POST', '/phone-capture/sessions/test/received', 'scholars'], ['DELETE', '/phone-capture/sessions/test', 'scholars'],
];
test('Billing reaches SuperAdmin operational actions only within assigned visible sections', async () => {
  for (const [method, path, section] of operational) {
    sectionAccess = [section]; reached.length = 0;
    assert.equal((await request(method, path)).status, 204, path);
    assert.equal(reached.length, 1);
    sectionAccess = []; reached.length = 0;
    assert.equal((await request(method, path)).status, 403, path);
    assert.equal(reached.length, 0);
    assert.equal((await request(method, path, false)).status, 401, path);
  }
});
test('Billing cannot access hidden management sections or question keys even with all section assignments', async () => {
  sectionAccess = ['settings', 'examination', 'scholars', 'billing', 'payroll', 'documentReviews'];
  for (const [method, path] of [
    ['GET', '/staff/management'], ['POST', '/staff'], ['PUT', '/staff/1'], ['PUT', '/staff/1/password'],
    ['GET', '/activity-logs'], ['GET', '/schools/catalog'],
    ['GET', '/online-examination/configuration'], ['PUT', '/online-examination/configuration'],
  ]) {
    reached.length = 0;
    assert.equal((await request(method, path)).status, 403, path);
    assert.equal(reached.length, 0);
  }
});
test('retired fund-release endpoints remain retired despite wider operational access', async () => {
  sectionAccess = ['billing', 'payroll'];
  for (const [method, path] of [['PUT', '/applications/1/paid'], ['PUT', '/payroll/billing-batch/1/release']]) {
    assert.equal((await request(method, path)).status, 410);
  }
});
