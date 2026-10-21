function createFixture() {
  const state = {
    now: new Date('2026-10-21T06:00:00Z'),
    schedules: [
      {
        id: 1,
        payroll_batch_id: 10,
        title: 'Synthetic payout schedule',
        status: 'published',
        revision: 1,
        starts_at: new Date('2026-10-21T00:00:00Z'),
        venue: 'Synthetic office',
      },
      {
        id: 2,
        payroll_batch_id: 10,
        title: 'Earlier cancelled schedule',
        status: 'cancelled',
        revision: 2,
        starts_at: new Date('2026-10-20T00:00:00Z'),
        venue: 'Synthetic office',
      },
    ],
    recipients: [
      { schedule_id: 1, payroll_batch_id: 10, applicant_id: 7, active: true },
      { schedule_id: 1, payroll_batch_id: 10, applicant_id: 8, active: true },
      { schedule_id: 2, payroll_batch_id: 10, applicant_id: 7, active: false },
    ],
    batches: [
      {
        id: 10,
        billing_period_id: 20,
        batch_number: 'PAY-SYNTHETIC',
        status: 'generated',
        total_scholars: 2,
      },
    ],
    people: [
      {
        id: 7,
        first_name: 'Synthetic',
        last_name: 'Scholar',
        municipality: 'Daet',
        deleted_at: null,
      },
      {
        id: 8,
        first_name: 'Other',
        last_name: 'Scholar',
        municipality: 'Labo',
        deleted_at: null,
      },
    ],
    claims: [
      {
        id: 70,
        applicant_id: 7,
        payroll_batch_id: 10,
        claim_amount: 3000,
        claim_status: 'listed',
        claimed_date: null,
      },
      {
        id: 80,
        applicant_id: 8,
        payroll_batch_id: 10,
        claim_amount: 3000,
        claim_status: 'listed',
        claimed_date: null,
      },
    ],
    attendance: [],
    receipts: [],
    activity: [],
  };
  const pick = (row, select) =>
    row &&
    (!select
      ? { ...row }
      : Object.fromEntries(Object.keys(select).map((key) => [key, row[key]])));
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) =>
      value instanceof Date
        ? +new Date(row[key]) === +value
        : value && typeof value === 'object'
          ? 'in' in value
            ? value.in.includes(row[key])
            : matches(row[key] || {}, value)
          : row[key] === value
    );
  const table = (collection, key) => ({
    findUnique: async ({ where }) => {
      const filter = where[key] || where;
      return pick(state[collection].find((row) => matches(row, filter)));
    },
    findMany: async ({ where } = {}) =>
      state[collection]
        .filter((row) => matches(row, where))
        .map((row) => ({ ...row })),
    create: async ({ data }) => {
      const keys =
        key === 'payroll_claim_id'
          ? ['payroll_claim_id']
          : ['schedule_id', 'applicant_id', 'session_starts_at'];
      if (
        state[collection].some((row) =>
          keys.every((k) =>
            k === 'session_starts_at'
              ? +new Date(row[k]) === +new Date(data[k])
              : row[k] === data[k]
          )
        )
      )
        throw Object.assign(new Error('Duplicate'), { code: 'P2002' });
      const row = { version: 1, ...data };
      state[collection].push(row);
      return { ...row };
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of state[collection])
        if (matches(row, where)) {
          Object.assign(row, {
            ...data,
            version: row.version + (data.version?.increment || 0),
          });
          count++;
        }
      return { count };
    },
  });
  const prisma = {
    payout_schedules: {
      findUnique: async ({ where }) => {
        const row = state.schedules.find((r) => r.id === where.id);
        return row
          ? {
              ...row,
              recipients: state.recipients.filter(
                (r) => r.schedule_id === row.id
              ),
            }
          : null;
      },
      findMany: async ({ where, include } = {}) =>
        state.schedules
          .filter(
            (row) =>
              (!where?.status || where.status.in.includes(row.status)) &&
              (!where?.recipients ||
                state.recipients.some(
                  (r) =>
                    r.schedule_id === row.id &&
                    r.applicant_id === where.recipients.some.applicant_id
                ))
          )
          .map((row) => ({
            ...row,
            recipients: state.recipients.filter(
              (r) =>
                r.schedule_id === row.id &&
                (!include?.recipients?.where ||
                  r.applicant_id === include.recipients.where.applicant_id)
            ),
          })),
    },
    payroll_batches: {
      findUnique: async ({ where }) =>
        state.batches.find((row) => row.id === where.id) || null,
      findMany: async ({ where } = {}) =>
        state.batches.filter((row) => matches(row, where)),
    },
    payroll_claims: {
      findUnique: async ({ where, select }) =>
        pick(
          state.claims.find((row) =>
            matches(row, where.payroll_batch_id_applicant_id)
          ),
          select
        ),
      findMany: async ({ where, select }) =>
        state.claims
          .filter((row) => matches(row, where))
          .map((row) => pick(row, select)),
    },
    applicants: {
      findFirst: async ({ where }) =>
        state.people.find((row) => matches(row, where)) || null,
      findUnique: async ({ where }) =>
        state.people.find((row) => row.id === where.id) || {
          id: 99,
          deleted_at: null,
        },
      findMany: async ({ where, select }) =>
        state.people
          .filter((row) => matches(row, where))
          .map((row) => pick(row, select)),
    },
    academic_periods: {
      findMany: async () => [
        { id: 20, school_year: '2026-2027', semester: '1st Semester' },
      ],
    },
    payout_schedule_attendance: table(
      'attendance',
      'schedule_id_applicant_id_session_starts_at'
    ),
    scholar_payout_receipts: table('receipts', 'payroll_claim_id'),
    admins: {
      findUnique: async ({ where }) => ({
        id: where.id,
        is_active: true,
        auth_version: 0,
        is_super_admin: false,
        role: 'billing',
        section_access: where.id === 2 ? ['reports'] : ['payroll'],
      }),
    },
    control_accounts: {
      findFirst: async () => ({ is_active: true, auth_version: 0 }),
    },
    scholar_accounts: {
      findFirst: async ({ where }) =>
        state.people.some((row) => row.id === where.applicant_id)
          ? { id: where.applicant_id }
          : null,
    },
    activity_logs: {
      create: async ({ data }) => {
        state.activity.push(data);
        return { id: 1 };
      },
    },
    $transaction: async (operation, options) => {
      if (options?.isolationLevel !== 'Serializable')
        throw new Error('Use serializable transactions');
      const snapshot = structuredClone({
        attendance: state.attendance,
        receipts: state.receipts,
      });
      try {
        return await operation(prisma);
      } catch (error) {
        state.attendance = snapshot.attendance;
        state.receipts = snapshot.receipts;
        throw error;
      }
    },
  };
  return { state, prisma };
}
module.exports = { createFixture };
