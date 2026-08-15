# Database schema review and cutover

## Current application database

The backend now uses the application-compatible clean database
`scholar_monitoring_v2` by default.

- Active Prisma schema: `backend/prisma/schema.application.prisma`
- Active generated client: `backend/generated/application-client`
- Connection selector: `backend/config/prisma.js`
- Original database retained for rollback: `scholar_monitoring`

Set `DATABASE_TARGET=legacy` before starting the backend to temporarily use the
original database. If the variable is absent, or has any value other than
`legacy`, the backend appends `_v2` to the database name in `DATABASE_URL`.

## Cutover verification

The following checks passed against the running application after cutover:

- administrator login
- active academic period endpoint
- dashboard summary endpoint
- applicant management endpoint
- scholar management endpoint
- applicant and scholar self-service application endpoints
- auto-increment insert inside a rolled-back transaction
- schema audit with no orphaned logical references
- schema audit with no duplicate groups for enforced unique keys

Current migrated records include:

- 12 applicants, application submissions, and control accounts
- 3 administrator accounts
- 2 examination slots and results
- 2 scholar accounts
- 1 payroll batch with 2 claims
- 1 active academic period for school year 2026-2027
- 9 schools

## Cleanups applied in `scholar_monitoring_v2`

The compatibility-clean schema removes unused data without requiring a broad
controller rewrite. It keeps active API field names and adds safer database
defaults, unique constraints, and indexes.

Removed attributes include:

- `applicants.id_number`, `entry_date`, and `entry_method`
- unused school contact and address columns
- unused payroll batch school and approval columns
- legacy payroll claim reference and rejection columns
- unused scholar requirement file/comment/review columns outside the current
  seven-document checklist

The schema also adds `exams.exam_end_date` for multi-day examination schedules,
uses auto-incrementing primary keys, defaults unclassified schools to `public`,
and enforces unique account, result, scholar, requirement, and payroll keys.

## Maintenance commands

Run these commands from `backend`:

```powershell
npm run schema:audit
npm run schema:provision-application
npm run schema:migrate-application
```

`schema:provision-application` creates or synchronizes `scholar_monitoring_v2`
and generates its Prisma client. Stop a running backend before regenerating the
client on Windows, because Node can hold the Prisma query-engine DLL open.

`schema:migrate-application` is an idempotent copy/upsert from the original
database into `scholar_monitoring_v2`; it also resets the auto-increment
sequences after preserving the source IDs.

## Future normalized proposal

`backend/prisma/schema.cleaned.prisma` remains a more aggressive normalized
proposal in the separate `scholar_monitoring_clean` database. It renames and
consolidates several active fields, including scholar document storage and
academic-period references. It is not the runtime schema because adopting it
would require a coordinated controller and API rewrite.

The original database and the normalized proposal are both preserved. The
runtime cutover only targets the application-compatible `scholar_monitoring_v2`
database.
