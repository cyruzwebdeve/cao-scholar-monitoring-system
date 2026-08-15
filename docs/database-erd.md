# PGCEAP clean database ERD

This ERD represents the active **scholar_monitoring_v2** database and is derived
from [schema.application.prisma](../backend/prisma/schema.application.prisma).
It replaces the earlier diagram of the legacy **scholar_monitoring** database.

## Relationship overview

~~~mermaid
erDiagram
    SCHOOLS ||--o{ APPLICANTS : "school_id"
    APPLICANTS ||--o{ APPLICATION_SUBMISSIONS : "applicant_id"
    APPLICANTS ||--o| CONTROL_ACCOUNTS : "applicant_id"

    APPLICANTS ||--o{ EXAM_SLOTS : "applicant_id"
    EXAMS ||--o{ EXAM_SLOTS : "exam_id"
    EXAM_SLOTS ||--o| RESULTS : "exam_slot_id"
    APPLICANTS ||--o{ RESULTS : "applicant_id"
    EXAMS ||--o{ RESULTS : "exam_id"
    ADMINS ||--o{ RESULTS : "recorded_by"

    APPLICANTS ||--o| SCHOLAR_ACCOUNTS : "applicant_id"
    RESULTS ||--o| SCHOLAR_ACCOUNTS : "result_id"
    ADMINS ||--o{ SCHOLAR_ACCOUNTS : "issued_by"

    APPLICANTS ||--o{ SCHOLAR_REQUIREMENTS : "applicant_id"
    ACADEMIC_PERIODS ||--o{ SCHOLAR_REQUIREMENTS : "billing_period_id"
    SCHOOLS ||--o{ SCHOLAR_REQUIREMENTS : "school_id"
    ADMINS ||--o{ SCHOLAR_REQUIREMENTS : "updated_by"

    ACADEMIC_PERIODS ||--o{ PAYROLL_BATCHES : "billing_period_id"
    ADMINS ||--o{ PAYROLL_BATCHES : "prepared / released by"
    PAYROLL_BATCHES ||--o{ PAYROLL_CLAIMS : "payroll_batch_id"
    APPLICANTS ||--o{ PAYROLL_CLAIMS : "applicant_id"

    ADMINS ||--o{ ACADEMIC_PERIODS : "created_by"
    ADMINS ||--o{ ANNOUNCEMENTS : "created_by"
~~~

The detailed entity-and-attribute diagram is available in:

- [database-erd.mmd](database-erd.mmd) — Mermaid, suitable for import into
  draw.io using **Arrange → Insert → Advanced → Mermaid**
- [database-erd.puml](database-erd.puml) — PlantUML

## Entity groups

| Area | Tables |
|---|---|
| Administration | academic_periods, activity_logs, admins, announcements |
| Applicant records | applicants, application_submissions, control_accounts, schools |
| Examination | exams, exam_slots, results |
| Scholar records | scholar_accounts, scholar_requirements |
| Billing and payroll | payroll_batches, payroll_claims |

## Relationship inventory

| Child field | Parent field | Cardinality | Database rule |
|---|---|---:|---|
| applicants.school_id | schools.id | many to zero/one | Indexed logical reference |
| application_submissions.applicant_id | applicants.id | many to zero/one | Indexed logical reference |
| control_accounts.applicant_id | applicants.id | zero/one to one | Unique |
| exam_slots.applicant_id | applicants.id | many to one | Composite unique with exam_id |
| exam_slots.exam_id | exams.id | many to one | Composite unique with applicant_id |
| results.exam_slot_id | exam_slots.id | zero/one to one | Unique |
| results.applicant_id | applicants.id | many to one | Indexed |
| results.exam_id | exams.id | many to one | Indexed |
| results.recorded_by | admins.id | many to zero/one | Logical reference |
| scholar_accounts.applicant_id | applicants.id | zero/one to one | Unique |
| scholar_accounts.result_id | results.id | zero/one to zero/one | Unique when present |
| scholar_accounts.issued_by | admins.id | many to zero/one | Logical reference |
| scholar_requirements.applicant_id | applicants.id | many to one | Composite unique with period |
| scholar_requirements.billing_period_id | academic_periods.id | many to one | Composite unique with applicant |
| scholar_requirements.school_id | schools.id | many to zero/one | Indexed |
| scholar_requirements.updated_by | admins.id | many to zero/one | Logical reference |
| payroll_batches.billing_period_id | academic_periods.id | many to one | Indexed with status |
| payroll_batches.prepared_by | admins.id | many to zero/one | Logical reference |
| payroll_batches.released_by | admins.id | many to zero/one | Logical reference |
| payroll_claims.payroll_batch_id | payroll_batches.id | many to one | Composite unique with applicant |
| payroll_claims.applicant_id | applicants.id | many to one | Composite unique with batch |
| academic_periods.created_by | admins.id | many to zero/one | Logical reference |
| announcements.created_by | admins.id | many to zero/one | Logical reference |

The current compatibility schema enforces primary keys, unique keys, defaults,
and lookup indexes. The ID connectors shown above are the relationships used by
the application; Prisma relation fields and PostgreSQL foreign-key constraints
have not yet been added.

**activity_logs** is intentionally disconnected because actor_id and target_id
are polymorphic references whose destination depends on their companion
type/table fields. Similarly, exams.created_by remains actor-like because
existing application flows do not guarantee that every value is an
administrator ID.

## Changes from the legacy ERD

- Removed applicant id_number, entry_date, and entry_method.
- Removed unused school contact and address attributes.
- Removed payroll batch school and approval fields.
- Removed the legacy payroll claim billing-statement reference and rejection field.
- Reduced scholar requirements to the current seven-document checklist.
- Added exams.exam_end_date for multi-day examination schedules.
- Added auto-incrementing primary keys and the unique/index rules shown above.
- School classification now defaults to public.
