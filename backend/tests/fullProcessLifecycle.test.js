const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { dataUrl, pdf } = require('./fixtures/documentFiles');

// Set up mock Prisma and services before requiring controllers
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const mailerPath = require.resolve('../services/mailer');
const mailsSent = [];
require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    sendApplicantAccountEmail: async (m) => { mailsSent.push({ type: 'applicant_account', ...m }); return { sent: true }; },
    sendScholarApprovedEmail: async (m) => { mailsSent.push({ type: 'scholar_approved', ...m }); return { sent: true }; },
    sendExamSubmittedEmail: async (m) => { mailsSent.push({ type: 'exam_submitted', ...m }); return { sent: true }; },
  },
};

const activityLogsRecorded = [];
const activityPath = require.resolve('../services/activityLog');
require.cache[activityPath] = {
  id: activityPath,
  filename: activityPath,
  loaded: true,
  exports: {
    recordActivitySafely: async (log) => { activityLogsRecorded.push(log); },
  },
};

process.env.JWT_SECRET = randomBytes(32).toString('hex');

// Load real application controllers and services
const {
  createApplication,
  uploadScholarRequirementByAdmin,
  acceptApplicantAsScholar,
  processPayrollSelection,
  processBillingSelection,
} = require('../controllers/applicationController');
const { examinationResultController } = require('../controllers/examinationResultController');
const passerLists = require('../controllers/passerListController');
const { saveBatch: saveGrantBatch } = require('../controllers/grantPreparationController');
const { createPayoutParticipationController } = require('../controllers/payoutParticipationController');
const payoutSchedules = require('../controllers/payoutScheduleController');
const { initialApproved } = require('../services/passerIntake');
const { resolveProcessingRoute } = require('../services/processingRoute');
const { evaluateListEligibility } = require('../services/lifecycleIntegrity');

// Helpers for mock HTTP request / response
const createResponse = () => ({
  statusCode: 200,
  headers: {},
  locals: {},
  set(k, v) { this.headers[k] = v; return this; },
  setHeader(k, v) { this.headers[k] = v; return this; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  send(body) { this.body = body; return this; },
  end() { this.ended = true; return this; },
});

// Shared in-memory database state
let db;

function resetDatabase() {
  mailsSent.length = 0;
  activityLogsRecorded.length = 0;
  const now = new Date('2026-11-20T08:00:00.000Z');

  db = {
    now,
    periods: [
      {
        id: 10,
        school_year: '2026-2027',
        semester: '1st Semester',
        is_active: true,
        is_primary: true,
        status: 'active',
        created_at: new Date('2026-06-01'),
        updated_at: new Date('2026-06-01'),
      },
      {
        id: 11,
        school_year: '2026-2027',
        semester: '2nd Semester',
        is_active: true,
        is_primary: false,
        status: 'active',
        created_at: new Date('2026-11-01'),
        updated_at: new Date('2026-11-01'),
      },
    ],
    intakeSettings: { id: 1, academic_period_id: 10, revision: 1 },
    appSettings: { id: 1, is_enabled: true, examination_enabled: true, exam_delivery_mode: 'paper' },
    schools: [
      { id: 1, name: 'University of Camarines Norte, Main Campus', school_type: 'Public', is_active: true },
      { id: 2, name: 'Mabini Colleges, Inc.', school_type: 'Private', is_active: true },
    ],
    exams: [
      {
        id: 1,
        academic_year: '2026-2027',
        municipality: 'Daet',
        title: 'Daet Qualifying Examination AY 2026-2027',
        venue: 'Provincial Capitol Social Hall, Daet',
        exam_date: new Date('2026-07-15T01:00:00Z'),
        exam_end_date: new Date('2026-07-15T05:00:00Z'),
        is_active: true,
        updated_at: new Date('2026-07-01'),
      },
    ],
    applicants: [],
    controlAccounts: [],
    applications: [],
    examSlots: [],
    results: [],
    passerLists: [],
    passerListMembers: [],
    scholars: [],
    scholarRequirements: [],
    assessments: [],
    payrollBatches: [],
    payrollClaims: [],
    payoutSchedules: [],
    payoutScheduleRecipients: [],
    payoutScheduleAttendance: [],
    scholarPayoutReceipts: [],
    notifications: [],
    emailDeliveries: [],
    admins: [
      { id: 1, full_name: 'Super Administrator', is_active: true, is_super_admin: true, role: 'SuperAdmin', section_access: ['settings', 'applicants', 'examination', 'scholars', 'billing', 'payroll', 'reports', 'announcements', 'documentReviews'] },
      { id: 2, full_name: 'Billing Payroll Officer', is_active: true, is_super_admin: false, role: 'BillingPayrollAdmin', section_access: ['applicants', 'examination', 'scholars', 'billing', 'payroll', 'documentReviews'] },
    ],
  };

  const matches = (row, where = {}) => {
    if (!where) return true;
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) continue;
      if (key === 'OR' && Array.isArray(value)) {
        if (!value.some((filter) => matches(row, filter))) return false;
        continue;
      }
      if (key === 'revisions' && typeof value === 'object') {
        continue;
      }
      if (value && typeof value === 'object') {
        if ('in' in value) {
          if (!value.in.includes(row[key])) return false;
        } else if ('not' in value) {
          if (row[key] === value.not) return false;
        } else if ('equals' in value) {
          if (row[key] !== value.equals) return false;
        } else if ('none' in value) {
          continue;
        } else if (value instanceof Date) {
          if (+new Date(row[key]) !== +value) return false;
        }
      } else if (row[key] !== value) {
        return false;
      }
    }
    return true;
  };

  Object.assign(prisma, {
    intake_settings: {
      findUnique: async () => ({ ...db.intakeSettings }),
    },
    academic_periods: {
      findUnique: async ({ where }) => db.periods.find((p) => p.id === where.id) || null,
      findFirst: async ({ where } = {}) => db.periods.find((p) => matches(p, where)) || null,
      findMany: async ({ where } = {}) => db.periods.filter((p) => matches(p, where)).map((p) => ({ ...p })),
    },
    application_settings: {
      findUnique: async () => ({ ...db.appSettings }),
    },
    applicants: {
      findFirst: async ({ where }) => db.applicants.find((a) => matches(a, where)) || null,
      findUnique: async ({ where }) => db.applicants.find((a) => a.id === where.id) || null,
      findMany: async ({ where } = {}) => db.applicants.filter((a) => matches(a, where)).map((a) => ({ ...a })),
      create: async ({ data }) => {
        const row = { id: db.applicants.length + 1, deleted_at: null, created_at: new Date(), ...data };
        db.applicants.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = db.applicants.find((a) => a.id === where.id);
        if (row) Object.assign(row, data);
        return { ...row };
      },
    },
    control_accounts: {
      findFirst: async ({ where }) => db.controlAccounts.find((c) => matches(c, where)) || null,
      findMany: async ({ where } = {}) => db.controlAccounts.filter((c) => matches(c, where)).map((c) => ({ ...c })),
      create: async ({ data }) => {
        const row = { id: db.controlAccounts.length + 1, is_active: true, auth_version: 0, ...data };
        db.controlAccounts.push(row);
        return { ...row };
      },
    },
    application_submissions: {
      findFirst: async ({ where }) => db.applications.find((app) => matches(app, where)) || null,
      findUnique: async ({ where }) => db.applications.find((app) => app.id === where.id) || null,
      findMany: async ({ where } = {}) => db.applications.filter((app) => matches(app, where)).map((app) => ({ ...app })),
      create: async ({ data }) => {
        const row = { id: db.applications.length + 100, submitted_at: new Date(), ...data };
        db.applications.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = db.applications.find((app) => app.id === where.id);
        if (row) Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const app of db.applications) {
          if (matches(app, where)) {
            Object.assign(app, data);
            count++;
          }
        }
        return { count };
      },
    },
    exams: {
      findFirst: async ({ where }) => db.exams.find((e) => matches(e, where)) || null,
      findUnique: async ({ where }) => db.exams.find((e) => e.id === where.id) || null,
      findMany: async ({ where } = {}) => db.exams.filter((e) => matches(e, where)).map((e) => ({ ...e })),
    },
    exam_slots: {
      findFirst: async ({ where }) => db.examSlots.find((s) => matches(s, where)) || null,
      findUnique: async ({ where }) => {
        const filter = where.applicant_id_exam_id || where;
        return db.examSlots.find((s) => s.applicant_id === filter.applicant_id && s.exam_id === filter.exam_id) || null;
      },
      findMany: async ({ where } = {}) => db.examSlots.filter((s) => matches(s, where)).map((s) => ({ ...s })),
      create: async ({ data }) => {
        const row = { id: db.examSlots.length + 1, ...data };
        db.examSlots.push(row);
        return { ...row };
      },
      createMany: async ({ data }) => {
        data.forEach((d) => db.examSlots.push({ id: db.examSlots.length + 1, ...d }));
        return { count: data.length };
      },
      upsert: async ({ where, create, update }) => {
        const filter = where.applicant_id_exam_id || where;
        let row = db.examSlots.find((s) => s.applicant_id === filter.applicant_id && s.exam_id === filter.exam_id);
        if (row) {
          Object.assign(row, update);
        } else {
          row = { id: db.examSlots.length + 1, ...create };
          db.examSlots.push(row);
        }
        return { ...row };
      },
    },
    results: {
      findFirst: async ({ where }) => db.results.find((r) => matches(r, where)) || null,
      findUnique: async ({ where }) => db.results.find((r) => r.id === where.id) || null,
      findMany: async ({ where } = {}) => db.results.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      create: async ({ data }) => {
        const row = { id: db.results.length + 1, updated_at: new Date(), ...data };
        db.results.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = db.results.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const res of db.results) {
          if (matches(res, where)) {
            Object.assign(res, data);
            count++;
          }
        }
        return { count };
      },
    },
    passer_lists: {
      findFirst: async ({ where }) => db.passerLists.find((l) => matches(l, where)) || null,
      findUnique: async ({ where, include }) => {
        const list = db.passerLists.find((l) => {
          if (where.id) return l.id === where.id;
          if (where.request_key) return l.request_key === where.request_key;
          return false;
        });
        if (!list) return null;
        const result = { ...list };
        if (include?.members) {
          result.members = db.passerListMembers.filter((m) => m.list_id === list.id).map((m) => ({ ...m }));
        }
        return result;
      },
      findMany: async ({ where, include } = {}) => {
        return db.passerLists.filter((l) => matches(l, where)).map((l) => {
          const item = { ...l };
          if (include?.members) {
            item.members = db.passerListMembers.filter((m) => m.list_id === l.id).map((m) => ({ ...m }));
          }
          return item;
        });
      },
      create: async ({ data, include }) => {
        const listId = db.passerLists.length + 1;
        const { members, ...listData } = data;
        const row = { id: listId, created_at: new Date(), ...listData };
        db.passerLists.push(row);
        if (members?.create) {
          for (const m of members.create) {
            const memberRow = { id: db.passerListMembers.length + 1, list_id: listId, ...m };
            db.passerListMembers.push(memberRow);
          }
        }
        const result = { ...row };
        if (include?.members) {
          result.members = db.passerListMembers.filter((m) => m.list_id === listId).map((m) => ({ ...m }));
        }
        return result;
      },
      update: async ({ where, data, include }) => {
        const row = db.passerLists.find((l) => l.id === where.id);
        if (row) Object.assign(row, data);
        const result = { ...row };
        if (include?.members) {
          result.members = db.passerListMembers.filter((m) => m.list_id === row.id).map((m) => ({ ...m }));
        }
        return result;
      },
    },
    passer_list_members: {
      findFirst: async ({ where }) => db.passerListMembers.find((m) => matches(m, where)) || null,
      findMany: async ({ where, include, select } = {}) => {
        return db.passerListMembers
          .filter((m) => {
            if (where?.academic_period_id && m.academic_period_id !== where.academic_period_id) return false;
            if (where?.applicant_id) {
              if (typeof where.applicant_id === 'object' && 'in' in where.applicant_id) {
                if (!where.applicant_id.in.includes(m.applicant_id)) return false;
              } else if (m.applicant_id !== where.applicant_id) {
                return false;
              }
            }
            if (where?.list) {
              const list = db.passerLists.find((l) => l.id === m.list_id);
              if (!list || list.status !== where.list.status) return false;
            }
            return true;
          })
          .map((m) => {
            const item = { ...m };
            if (include?.list) {
              item.list = db.passerLists.find((l) => l.id === m.list_id) || null;
            }
            if (select) {
              return Object.fromEntries(Object.keys(select).map((k) => [k, item[k]]));
            }
            return item;
          });
      },
      create: async ({ data }) => {
        const row = { id: db.passerListMembers.length + 1, ...data };
        db.passerListMembers.push(row);
        return { ...row };
      },
      createMany: async ({ data }) => {
        data.forEach((d) => db.passerListMembers.push({ id: db.passerListMembers.length + 1, ...d }));
        return { count: data.length };
      },
      update: async ({ where, data }) => {
        const row = db.passerListMembers.find((m) => m.id === where.id);
        if (row) Object.assign(row, data);
        return { ...row };
      },
    },
    scholar_accounts: {
      findFirst: async ({ where }) => db.scholars.find((s) => matches(s, where)) || null,
      findUnique: async ({ where }) => db.scholars.find((s) => s.id === where.id || s.applicant_id === where.applicant_id) || null,
      findMany: async ({ where, select } = {}) => {
        return db.scholars.filter((s) => matches(s, where)).map((s) => {
          if (!select) return { ...s };
          return Object.fromEntries(Object.keys(select).map((k) => [k, s[k]]));
        });
      },
      create: async ({ data }) => {
        const row = { id: db.scholars.length + 1, created_at: new Date(), ...data };
        db.scholars.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = db.scholars.find((s) => s.id === where.id || s.applicant_id === where.applicant_id);
        if (row) Object.assign(row, data);
        return { ...row };
      },
    },
    scholar_requirements: {
      findFirst: async ({ where }) => db.scholarRequirements.find((r) => matches(r, where)) || null,
      findUnique: async ({ where }) => {
        const filter = where.applicant_id_billing_period_id || where;
        return db.scholarRequirements.find((r) => r.applicant_id === filter.applicant_id && r.billing_period_id === filter.billing_period_id) || null;
      },
      findMany: async ({ where, select } = {}) => {
        return db.scholarRequirements.filter((r) => matches(r, where)).map((r) => {
          if (!select) return { ...r };
          return Object.fromEntries(Object.keys(select).map((k) => [k, r[k]]));
        });
      },
      upsert: async ({ where, create, update }) => {
        const filter = where.applicant_id_billing_period_id || where;
        let row = db.scholarRequirements.find((r) => r.applicant_id === filter.applicant_id && r.billing_period_id === filter.billing_period_id);
        if (row) {
          Object.assign(row, update);
        } else {
          row = { id: db.scholarRequirements.length + 1, ...create };
          db.scholarRequirements.push(row);
        }
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const req of db.scholarRequirements) {
          if (matches(req, where)) {
            Object.assign(req, data);
            count++;
          }
        }
        return { count };
      },
    },
    eligibility_assessments: {
      findFirst: async ({ where }) => db.assessments.find((a) => matches(a, where)) || null,
      create: async ({ data }) => {
        const row = { id: db.assessments.length + 1, ...data };
        db.assessments.push(row);
        return { ...row };
      },
    },
    schools: {
      findFirst: async ({ where }) => db.schools.find((s) => matches(s, where)) || null,
      findUnique: async ({ where }) => db.schools.find((s) => s.id === where.id) || null,
      findMany: async ({ where, select } = {}) => {
        return db.schools.filter((s) => matches(s, where)).map((s) => {
          if (!select) return { ...s };
          return Object.fromEntries(Object.keys(select).map((k) => [k, s[k]]));
        });
      },
    },
    payroll_batches: {
      findFirst: async ({ where }) => db.payrollBatches.find((b) => matches(b, where)) || null,
      findUnique: async ({ where }) => db.payrollBatches.find((b) => b.id === where.id) || null,
      findMany: async ({ where, select } = {}) => {
        return db.payrollBatches.filter((b) => matches(b, where)).map((b) => {
          if (!select) return { ...b };
          return Object.fromEntries(Object.keys(select).map((k) => [k, b[k]]));
        });
      },
      create: async ({ data }) => {
        const row = { id: db.payrollBatches.length + 1, created_at: new Date(), ...data };
        db.payrollBatches.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = db.payrollBatches.find((b) => b.id === where.id);
        if (row) Object.assign(row, data);
        return { ...row };
      },
    },
    payroll_claims: {
      findFirst: async ({ where }) => db.payrollClaims.find((c) => matches(c, where)) || null,
      findUnique: async ({ where, select }) => {
        const filter = where.payroll_batch_id_applicant_id || where;
        const row = db.payrollClaims.find((c) => {
          if (filter.payroll_claim_id) return c.id === filter.payroll_claim_id;
          if (filter.id) return c.id === filter.id;
          return c.payroll_batch_id === filter.payroll_batch_id && c.applicant_id === filter.applicant_id;
        });
        if (!row) return null;
        if (!select) return { ...row };
        return Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]));
      },
      findMany: async ({ where, select } = {}) => {
        return db.payrollClaims.filter((c) => matches(c, where)).map((c) => {
          if (!select) return { ...c };
          return Object.fromEntries(Object.keys(select).map((k) => [k, c[k]]));
        });
      },
      createMany: async ({ data }) => {
        data.forEach((d) => db.payrollClaims.push({ id: db.payrollClaims.length + 1, ...d }));
        return { count: data.length };
      },
    },
    payout_schedules: {
      findUnique: async ({ where, include }) => {
        const schedule = db.payoutSchedules.find((s) => s.id === where.id);
        if (!schedule) return null;
        const row = { ...schedule };
        if (include?.recipients || true) {
          row.recipients = db.payoutScheduleRecipients.filter((r) => r.schedule_id === schedule.id).map((r) => ({ ...r }));
        }
        return row;
      },
      findMany: async ({ where } = {}) => {
        return db.payoutSchedules
          .filter((s) => {
            if (where?.status?.in && !where.status.in.includes(s.status)) return false;
            return true;
          })
          .map((s) => ({
            ...s,
            recipients: db.payoutScheduleRecipients.filter((r) => r.schedule_id === s.id).map((r) => ({ ...r })),
          }));
      },
      create: async ({ data }) => {
        const row = { id: db.payoutSchedules.length + 1, revision: 1, created_at: new Date(), ...data };
        db.payoutSchedules.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = db.payoutSchedules.find((s) => s.id === where.id);
        if (row) Object.assign(row, data);
        return { ...row };
      },
    },
    payout_schedule_recipients: {
      findMany: async ({ where } = {}) => db.payoutScheduleRecipients.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      createMany: async ({ data }) => {
        data.forEach((d) => db.payoutScheduleRecipients.push({ ...d }));
        return { count: data.length };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const r of db.payoutScheduleRecipients) {
          if (matches(r, where)) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      },
      deleteMany: async ({ where }) => {
        db.payoutScheduleRecipients = db.payoutScheduleRecipients.filter((r) => !matches(r, where));
        return { count: 1 };
      },
    },
    payout_schedule_attendance: {
      findUnique: async ({ where }) => {
        const key = where.schedule_id_applicant_id_session_starts_at || where;
        return db.payoutScheduleAttendance.find((a) =>
          a.schedule_id === key.schedule_id &&
          a.applicant_id === key.applicant_id &&
          +new Date(a.session_starts_at) === +new Date(key.session_starts_at)
        ) || null;
      },
      findMany: async ({ where } = {}) => db.payoutScheduleAttendance.filter((a) => matches(a, where)).map((a) => ({ ...a })),
      create: async ({ data }) => {
        const row = { version: 1, ...data };
        db.payoutScheduleAttendance.push(row);
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const a of db.payoutScheduleAttendance) {
          if (a.schedule_id === where.schedule_id && a.applicant_id === where.applicant_id && a.version === where.version) {
            Object.assign(a, { ...data, version: a.version + (data.version?.increment || 0) });
            count++;
          }
        }
        return { count };
      },
    },
    scholar_payout_receipts: {
      findUnique: async ({ where }) => db.scholarPayoutReceipts.find((r) => r.payroll_claim_id === where.payroll_claim_id) || null,
      findMany: async ({ where } = {}) => db.scholarPayoutReceipts.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      create: async ({ data }) => {
        const row = { version: 1, ...data };
        db.scholarPayoutReceipts.push(row);
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const r of db.scholarPayoutReceipts) {
          if (r.payroll_claim_id === where.payroll_claim_id && r.version === where.version) {
            Object.assign(r, { ...data, version: r.version + (data.version?.increment || 0) });
            count++;
          }
        }
        return { count };
      },
    },
    scholar_notifications: {
      createMany: async ({ data }) => {
        data.forEach((d) => db.notifications.push({ id: db.notifications.length + 1, ...d }));
        return { count: data.length };
      },
      findMany: async ({ where } = {}) => db.notifications.filter((n) => matches(n, where)).map((n) => ({ ...n })),
    },
    payout_schedule_email_deliveries: {
      createMany: async ({ data }) => {
        data.forEach((d) => db.emailDeliveries.push({ id: db.emailDeliveries.length + 1, ...d }));
        return { count: data.length };
      },
      groupBy: async () => [],
    },
    admins: {
      findUnique: async ({ where }) => db.admins.find((a) => a.id === where.id) || null,
      findMany: async ({ where } = {}) => db.admins.filter((a) => matches(a, where)).map((a) => ({ ...a })),
    },
    $queryRaw: async () => [{ id: 1, value: 1 }],
    $transaction: async (callback, options = {}) => {
      return callback(prisma);
    },
  });
}

test('FULL SYSTEM LIFECYCLE: 2 Applications (1 Public, 1 Private) from Application to Payroll/Billing and Payout Acknowledgement', async () => {
  resetDatabase();
  const participationController = createPayoutParticipationController({
    prisma,
    now: () => db.now,
  });

  const superAdmin = { id: 1, role: 'SuperAdmin' };
  const billingAdmin = { id: 2, role: 'BillingPayrollAdmin', sectionAccess: ['billing', 'payroll', 'scholars', 'examination', 'applicants', 'documentReviews'] };

  // =========================================================================
  // STEP 1: Application Submission (1 Public school, 1 Private school)
  // =========================================================================
  // 1A: Public school application
  const publicReq = {
    body: {
      email: 'juan.delacruz@example.ph',
      password: 'Password123!',
      academicPeriodId: 10,
      academicYear: '2026-2027',
      personalInfo: {
        identity: {
          firstName: 'Juan',
          middleName: 'Ramos',
          familyName: 'Dela Cruz',
          nameExtension: '',
          sex: 'Male',
          birthday: '2005-04-12',
          mobile: '09181234567',
          civilStatus: 'Single',
        },
        address: {
          houseNumber: 'Blk 1 Lot 2',
          barangay: 'Barangay I',
          municipality: 'Daet',
        },
        schoolPlan: {
          school: 'University of Camarines Norte, Main Campus',
          incomingYearLevel: '1st Year',
          course: 'BS Computer Science',
        },
        family: {
          fatherName: 'Pedro Dela Cruz',
          fatherOccupation: 'Farmer',
          motherName: 'Maria Dela Cruz',
          motherOccupation: 'Housewife',
          familyIncome: '100,001 - 150,000',
          gwa: '92.5',
          brothersCount: '1',
          sistersCount: '1',
        },
        eligibility: {
          siblingRuleAccepted: true,
        },
      },
    },
  };
  const publicRes = createResponse();
  await createApplication(publicReq, publicRes);
  assert.equal(publicRes.statusCode, 201, 'Public application must be created with 201');
  assert.ok(publicRes.body.applicant.controlNumber, 'Control number must be generated for Public applicant');
  assert.equal(db.applicants.length, 1);
  assert.equal(db.applicants[0].email, 'juan.delacruz@example.ph');
  assert.equal(db.applications[0].school_plan.school, 'University of Camarines Norte, Main Campus');
  assert.equal(db.examSlots.length, 1, 'Exam slot should be automatically assigned');
  assert.equal(db.examSlots[0].exam_id, 1, 'Assigned to Daet exam');

  // Sibling rule verification: Attempting another sibling with matching parents must be rejected
  const siblingReq = {
    body: {
      email: 'sibling.delacruz@example.ph',
      academicPeriodId: 10,
      academicYear: '2026-2027',
      personalInfo: {
        identity: { firstName: 'Carlos', familyName: 'Dela Cruz', birthday: '2006-01-01' },
        address: { municipality: 'Daet' },
        schoolPlan: { school: 'University of Camarines Norte, Main Campus', incomingYearLevel: '1st Year' },
        family: { fatherName: 'Pedro Dela Cruz', motherName: 'Maria Dela Cruz' },
        eligibility: { siblingRuleAccepted: true },
      },
    },
  };
  const siblingRes = createResponse();
  await createApplication(siblingReq, siblingRes);
  assert.equal(siblingRes.statusCode, 409, 'Duplicate sibling application must be rejected with 409');
  assert.equal(siblingRes.body.code, 'SIBLING_ALREADY_APPLIED');

  // 1B: Private school application
  const privateReq = {
    body: {
      email: 'clara.santos@example.ph',
      password: 'Password123!',
      academicPeriodId: 10,
      academicYear: '2026-2027',
      personalInfo: {
        identity: {
          firstName: 'Clara',
          middleName: 'Gomez',
          familyName: 'Santos',
          sex: 'Female',
          birthday: '2005-09-20',
          mobile: '09192345678',
          civilStatus: 'Single',
        },
        address: {
          houseNumber: 'Unit 4',
          barangay: 'Barangay II',
          municipality: 'Daet',
        },
        schoolPlan: {
          school: 'Mabini Colleges, Inc.',
          incomingYearLevel: '1st Year',
          course: 'BS Nursing',
        },
        family: {
          fatherName: 'Roberto Santos',
          fatherOccupation: 'Electrician',
          motherName: 'Elena Santos',
          motherOccupation: 'Vendor',
          familyIncome: '100,001 - 150,000',
          gwa: '94.0',
          brothersCount: '0',
          sistersCount: '1',
        },
        eligibility: {
          siblingRuleAccepted: true,
        },
      },
    },
  };
  const privateRes = createResponse();
  await createApplication(privateReq, privateRes);
  assert.equal(privateRes.statusCode, 201, 'Private application must be created with 201');
  assert.ok(privateRes.body.applicant.controlNumber, 'Control number must be generated for Private applicant');
  assert.equal(db.applicants.length, 2);
  assert.equal(db.applicants[1].email, 'clara.santos@example.ph');
  assert.equal(db.applications[1].school_plan.school, 'Mabini Colleges, Inc.');
  assert.equal(db.examSlots.length, 2);
  assert.equal(mailsSent.length, 2, 'Two applicant account credential emails dispatched');

  // =========================================================================
  // STEP 2: Examination Attendance, Scoring, Result Publication & Passer List
  // =========================================================================
  const publicApplicantId = 1;
  const privateApplicantId = 2;

  // 2A: Staff marks attendance as Present for both applicants
  db.examSlots[0].appeared = true;
  db.examSlots[1].appeared = true;

  // 2B: Record scores
  // Public applicant: 17.5/20
  const scorePubRes = createResponse();
  await examinationResultController.record({
    params: { examId: '1', applicantId: String(publicApplicantId) },
    body: { score: 17.5, passingScore: 14.0, remarks: 'Excellent performance' },
    user: superAdmin,
  }, scorePubRes);
  assert.equal(scorePubRes.statusCode, 201, 'Score recorded for Public examinee');
  assert.equal(scorePubRes.body.result.status, 'Passed');

  // Private applicant: 18.0/20
  const scorePrivRes = createResponse();
  await examinationResultController.record({
    params: { examId: '1', applicantId: String(privateApplicantId) },
    body: { score: 18.0, passingScore: 14.0, remarks: 'Superior score' },
    user: superAdmin,
  }, scorePrivRes);
  assert.equal(scorePrivRes.statusCode, 201, 'Score recorded for Private examinee');
  assert.equal(scorePrivRes.body.result.status, 'Passed');

  // 2C: Publish results
  const pubPublishRes = createResponse();
  await examinationResultController.publish({
    params: { examId: '1', applicantId: String(publicApplicantId) },
    body: { resultId: db.results[0].id, updatedAt: db.results[0].updated_at.toISOString() },
    user: superAdmin,
  }, pubPublishRes);
  assert.equal(pubPublishRes.statusCode, 200, 'Public examinee result published');

  const privPublishRes = createResponse();
  await examinationResultController.publish({
    params: { examId: '1', applicantId: String(privateApplicantId) },
    body: { resultId: db.results[1].id, updatedAt: db.results[1].updated_at.toISOString() },
    user: superAdmin,
  }, privPublishRes);
  assert.equal(privPublishRes.statusCode, 200, 'Private examinee result published');

  // 2D: Create & Post locked Passer List
  const passerListRes = createResponse();
  await passerLists.create({
    body: {
      academicPeriodId: 10,
      requestKey: randomUUID(),
      status: 'posted',
      title: 'Official Passer List AY 2026-2027 Batch 1',
      members: [
        {
          applicantId: publicApplicantId,
          resultId: db.results[0].id,
          examId: 1,
          applicationId: db.applications[0].id,
          updatedAt: db.results[0].updated_at.toISOString(),
        },
        {
          applicantId: privateApplicantId,
          resultId: db.results[1].id,
          examId: 1,
          applicationId: db.applications[1].id,
          updatedAt: db.results[1].updated_at.toISOString(),
        },
      ],
    },
    user: superAdmin,
  }, passerListRes);
  assert.equal(passerListRes.statusCode, 201, 'Passer list created and locked as posted');
  assert.equal(db.passerLists[0].status, 'posted');
  assert.equal(db.passerListMembers.length, 2, 'Both passers registered as posted members');

  // =========================================================================
  // STEP 3: Initial Requirement Intake & Document Verification
  // =========================================================================
  // 3A: Public Applicant Document Intake
  // Required for 1st Year entry: tax_exemption, valid_id, report_card (Grade 12 card), registration_form.
  for (const key of ['tax_exemption', 'valid_id', 'report_card', 'registration_form']) {
    const uploadRes = createResponse();
    await uploadScholarRequirementByAdmin({
      params: { applicantId: String(publicApplicantId), requirementKey: key },
      body: { academicPeriodId: 10, fileName: `${key}.pdf`, fileData: dataUrl(pdf) },
      user: billingAdmin,
    }, uploadRes);
    assert.equal(uploadRes.statusCode, 200, `Uploaded ${key} for public applicant`);
    assert.equal(uploadRes.body.document.status, 'Approved');
  }

  // POLICY ENFORCEMENT: Public applicant cannot upload a tuition fee receipt
  const invalidReceiptRes = createResponse();
  await uploadScholarRequirementByAdmin({
    params: { applicantId: String(publicApplicantId), requirementKey: 'tuition_receipt' },
    body: { academicPeriodId: 10, fileName: 'receipt.pdf', fileData: dataUrl(pdf) },
    user: billingAdmin,
  }, invalidReceiptRes);
  assert.equal(invalidReceiptRes.statusCode, 400, 'Tuition receipt for public scholar must be rejected');
  assert.match(invalidReceiptRes.body.message, /applies only to private-school scholars/i);

  // Verify Public Initial Approval
  assert.equal(initialApproved(db.applications[0].initial_docs, 10, 'Public', 10, '1st Year'), true, 'Public initial docs complete');

  // 3B: Private Applicant Document Intake
  // Upload 4 docs without tuition receipt first
  for (const key of ['tax_exemption', 'valid_id', 'report_card', 'registration_form']) {
    const uploadRes = createResponse();
    await uploadScholarRequirementByAdmin({
      params: { applicantId: String(privateApplicantId), requirementKey: key },
      body: { academicPeriodId: 10, fileName: `${key}.pdf`, fileData: dataUrl(pdf) },
      user: billingAdmin,
    }, uploadRes);
    assert.equal(uploadRes.statusCode, 200, `Uploaded ${key} for private applicant`);
  }

  // POLICY ENFORCEMENT: Private applicant without tuition receipt is NOT approved
  assert.equal(initialApproved(db.applications[1].initial_docs, 10, 'Private', 10, '1st Year'), false, 'Private applicant requires tuition receipt');

  // Now upload the 5th required document: tuition_receipt
  const privDocReceiptRes = createResponse();
  await uploadScholarRequirementByAdmin({
    params: { applicantId: String(privateApplicantId), requirementKey: 'tuition_receipt' },
    body: { academicPeriodId: 10, fileName: 'official_tuition_receipt.pdf', fileData: dataUrl(pdf) },
    user: billingAdmin,
  }, privDocReceiptRes);
  assert.equal(privDocReceiptRes.statusCode, 200, 'Tuition receipt accepted for private applicant');
  assert.equal(privDocReceiptRes.body.document.status, 'Approved');

  // Verify Private Initial Approval with tuition receipt
  assert.equal(initialApproved(db.applications[1].initial_docs, 10, 'Private', 10, '1st Year'), true, 'Private initial docs complete');

  // =========================================================================
  // STEP 4: Official Scholar Acceptance (Accept as Scholar)
  // =========================================================================
  // Accept Public Passer
  const acceptPubRes = createResponse();
  await acceptApplicantAsScholar({
    params: { applicantId: String(publicApplicantId) },
    body: {
      academicPeriodId: 10,
      examId: 1,
      resultId: db.results[0].id,
      applicationId: db.applications[0].id,
      updatedAt: db.results[0].updated_at.toISOString(),
      reviewReason: 'Passer verified with complete approved initial documents',
    },
    user: superAdmin,
  }, acceptPubRes);
  assert.equal(acceptPubRes.statusCode, 201, 'Public applicant accepted as Scholar');
  assert.ok(acceptPubRes.body.scholar.scholar_id.startsWith('PGCEAP-2026-'), 'Public scholar ID formatted properly');
  assert.equal(acceptPubRes.body.eligibilityAssessment.recommendation, 'MEETS_CONFIGURED_CRITERIA');

  // Accept Private Passer
  const acceptPrivRes = createResponse();
  await acceptApplicantAsScholar({
    params: { applicantId: String(privateApplicantId) },
    body: {
      academicPeriodId: 10,
      examId: 1,
      resultId: db.results[1].id,
      applicationId: db.applications[1].id,
      updatedAt: db.results[1].updated_at.toISOString(),
      reviewReason: 'Passer verified with complete approved initial documents including tuition receipt',
    },
    user: superAdmin,
  }, acceptPrivRes);
  assert.equal(acceptPrivRes.statusCode, 201, 'Private applicant accepted as Scholar');
  assert.ok(acceptPrivRes.body.scholar.scholar_id.startsWith('PGCEAP-2026-'), 'Private scholar ID formatted properly');
  assert.equal(acceptPrivRes.body.eligibilityAssessment.recommendation, 'MEETS_CONFIGURED_CRITERIA');

  assert.equal(db.scholars.length, 2, 'Both scholars activated in database');
  assert.equal(db.scholars.every((s) => s.is_active), true, 'Both scholars are active');

  // =========================================================================
  // STEP 5: School Classification Routing & Private Grant Preparation
  // =========================================================================
  // Check initial period processing routes:
  const pubRoute = resolveProcessingRoute({ schoolType: 'Public', docs: db.applications[0].initial_docs, period: db.periods[0] });
  assert.equal(pubRoute, 'payroll', 'Initial public route is payroll');

  const privInitialRoute = resolveProcessingRoute({ schoolType: 'Private', docs: db.applications[1].initial_docs, period: db.periods[0] });
  assert.equal(privInitialRoute, 'payroll', 'Initial private route is payroll');

  // In continuing semester (Period 11), Public remains Payroll while Private routes to Billing:
  const pubContinuingRoute = resolveProcessingRoute({ schoolType: 'Public', docs: db.applications[0].initial_docs, period: db.periods[1], legacyPeriodId: 10 });
  assert.equal(pubContinuingRoute, 'payroll', 'Continuing public route is payroll');

  const privContinuingRoute = resolveProcessingRoute({ schoolType: 'Private', docs: db.applications[1].initial_docs, period: db.periods[1], legacyPeriodId: 10 });
  assert.equal(privContinuingRoute, 'billing', 'Continuing private route is billing');

  // Staff prepares Private Scholar grant breakdown in Billing workspace (Prepare Scholars)
  // Policy: Total cap = ₱5,000.00; Tuition verified = ₱3,500.00; Living allowance = ₱1,500.00
  const prepRes = createResponse();
  await saveGrantBatch({
    body: {
      academicPeriodId: 11,
      entries: [
        {
          applicantId: privateApplicantId,
          tuitionFeeAssistance: 3500,
        },
      ],
    },
    user: billingAdmin,
  }, prepRes);
  assert.equal(prepRes.statusCode, 200, 'Private scholar grant breakdown saved');
  assert.equal(prepRes.body.savedCount, 1);
  const preparedGrant = prepRes.body.results[0].grant;
  assert.equal(preparedGrant.totalGrant, 5000);
  assert.equal(preparedGrant.tuitionFeeAssistance, 3500);
  assert.equal(preparedGrant.allowance, 1500);

  // =========================================================================
  // STEP 6: Official List Generation (Payroll & Billing Batches)
  // =========================================================================
  // 6A: Generate Official Payroll List for Public Scholar (Period 10)
  const payrollRes = createResponse();
  await processPayrollSelection({
    body: {
      academicPeriodId: 10,
      applicantIds: [publicApplicantId],
    },
    user: billingAdmin,
  }, payrollRes);
  assert.equal(payrollRes.statusCode, 201, 'Payroll batch generated for Public scholar');
  assert.ok(payrollRes.body.batch.batchNumber.startsWith('PAY-'), 'Payroll batch has PAY- reference');
  assert.equal(payrollRes.body.batch.totalScholars, 1);
  const payrollBatchId = payrollRes.body.batch.id;
  assert.equal(db.payrollClaims.filter((c) => c.applicant_id === publicApplicantId).length, 1);

  // 6B: Generate Official Billing List for Private Scholar (Period 11)
  const billingRes = createResponse();
  await processBillingSelection({
    body: {
      academicPeriodId: 11,
      applicantIds: [privateApplicantId],
    },
    user: billingAdmin,
  }, billingRes);
  assert.equal(billingRes.statusCode, 201, 'Billing batch generated for Private scholar');
  assert.ok(billingRes.body.batch.batchNumber.startsWith('BILL-'), 'Billing batch has BILL- reference');
  assert.equal(billingRes.body.batch.totalScholars, 1);
  assert.equal(db.payrollClaims.filter((c) => c.applicant_id === privateApplicantId).length, 1);

  // Verify duplicate listing prevention: Scholar cannot be processed twice in the same period
  const duplicateRes = createResponse();
  await processPayrollSelection({
    body: {
      academicPeriodId: 10,
      applicantIds: [publicApplicantId],
    },
    user: billingAdmin,
  }, duplicateRes);
  assert.equal(duplicateRes.statusCode, 409, 'Duplicate listing in same period must be rejected with 409 Conflict');

  // =========================================================================
  // STEP 7: Informational Payout Schedule, Attendance & Scholar Receipt
  // =========================================================================
  // 7A: Staff creates and publishes informational Payout Schedule for the Payroll batch
  const scheduleRes = createResponse();
  await payoutSchedules.save({
    params: {},
    body: {
      action: 'publish',
      batchId: payrollBatchId,
      applicantIds: [publicApplicantId],
      title: 'AY 2026-2027 1st Semester Payout Distribution',
      venue: 'Provincial Capitol Social Hall, Daet',
      startsAt: new Date(db.now.getTime() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
      endsAt: null,
      instructions: 'Bring original School ID and 2 photocopies.',
    },
    user: billingAdmin,
  }, scheduleRes);
  assert.equal(scheduleRes.statusCode, 201, 'Payout schedule published');
  const scheduleId = db.payoutSchedules[0].id;
  assert.equal(db.payoutSchedules[0].status, 'published');
  assert.equal(db.payoutScheduleRecipients.length, 1);
  assert.equal(db.notifications.length, 1, 'In-app notification sent to scheduled scholar');

  // 7B: Staff records Attendance at venue
  const attendanceRes = createResponse();
  await participationController.attendance({
    params: { id: String(scheduleId), applicantId: String(publicApplicantId) },
    body: {
      attendance: 'present',
      scheduleRevision: 1,
      expectedVersion: 0,
    },
    user: billingAdmin,
  }, attendanceRes);
  assert.equal(attendanceRes.statusCode, 200, 'Staff recorded scholar attendance as Present');
  assert.equal(attendanceRes.body.attendance.status, 'present');

  // 7C: Scholar confirms receipt through Scholar Portal with legal attestation
  const receiptRes = createResponse();
  await participationController.receipt({
    params: { id: String(scheduleId) },
    body: {
      action: 'received',
      confirmed: true,
      receivedOn: '2026-11-20',
      scheduleRevision: 1,
      expectedVersion: 0,
    },
    user: { id: publicApplicantId, role: 'Scholar' },
  }, receiptRes);
  assert.equal(receiptRes.statusCode, 200, 'Scholar confirmed receipt with personal attestation');
  assert.equal(receiptRes.body.receipt.status, 'received');
  assert.equal(receiptRes.body.receipt.receivedOn, '2026-11-20');

  // 7D: View Schedule Attendance & Status Roster
  const indexRes = createResponse();
  await participationController.index({
    params: { id: String(scheduleId) },
    user: billingAdmin,
  }, indexRes);
  assert.equal(indexRes.statusCode, 200);
  assert.equal(indexRes.body.rows.length, 1);
  const row = indexRes.body.rows[0];
  assert.equal(row.name, 'Juan Ramos Dela Cruz');
  assert.equal(row.attendance.status, 'present');
  assert.equal(row.receipt.status, 'received');

  // =========================================================================
  // STEP 8: Product Scope Boundary & Anti-Disbursement Verification
  // =========================================================================
  // 1. Separate models & semantics
  assert.equal(db.payoutScheduleAttendance.length, 1, 'Staff attendance record exists');
  assert.equal(db.scholarPayoutReceipts.length, 1, 'Scholar receipt record exists');
  assert.notEqual(db.payoutScheduleAttendance[0], db.scholarPayoutReceipts[0]);

  // 2. Attendance does NOT equal receipt verification
  assert.equal(db.payoutScheduleAttendance[0].attendance, 'present');
  assert.equal(db.scholarPayoutReceipts[0].is_received, true);

  // 3. Monetary totals represent generated payroll allocations, NOT released cash
  const totalPayrollAllocation = db.payrollBatches
    .filter((b) => b.batch_number.startsWith('PAY-'))
    .reduce((sum, b) => sum + Number(b.total_amount), 0);
  assert.equal(totalPayrollAllocation, 3000, 'Payroll batch represents official list allocation (₱3,000 for Public scholar)');

  const totalBillingAllocation = db.payrollBatches
    .filter((b) => b.batch_number.startsWith('BILL-'))
    .reduce((sum, b) => sum + Number(b.total_amount), 0);
  assert.equal(totalBillingAllocation, 5000, 'Billing batch represents official list allocation');

  // 4. Confirm no monetary disbursement, cash claiming, or banking disbursement exists
  assert.equal(db.payrollClaims.every((c) => c.claimed_date === undefined || c.claimed_date === null), true, 'No claimed date set');
});
