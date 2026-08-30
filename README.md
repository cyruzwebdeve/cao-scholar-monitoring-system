# PGCEAP Scholarship Management System

A full-stack scholarship management system for applicant processing,
examinations, scholar records, billing, payroll, announcements, reports, and
academic-period administration.

## System scope boundary

The managed scholarship process ends when CAO generates the official payroll
list of scholars. The system may validate scholars, prepare billing records,
and generate that list, but fund release, payment claiming, disbursement,
financial reconciliation, and auditing of released money are outside scope.
Operational Activity Logs cover system access and record changes only; they
are not financial-disbursement audits.

Older payment-oriented surfaces that require controlled removal are listed in
the [scope boundary audit](docs/scope-boundary-audit.md).

## Technology

- React and Vite frontend
- Node.js and Express backend
- PostgreSQL database
- Prisma ORM

## Local setup

Requirements:

- Node.js and npm
- PostgreSQL

Install dependencies from the project directory:

~~~powershell
npm install
npm --prefix frontend install
npm --prefix backend install
~~~

Create the backend environment file:

~~~powershell
Copy-Item backend/.env.example backend/.env
~~~

Update backend/.env with your PostgreSQL password and a secure JWT secret. The
configured database name is the source name; the application automatically
uses its application-compatible clean database with the suffix **_v2**.

Provision the clean database and generate its Prisma client:

~~~powershell
npm --prefix backend run schema:provision-application
~~~

Start the frontend and backend together:

~~~powershell
npm run dev
~~~

The default local addresses are:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3601/api

## Database tools

Open the active clean database in Prisma Studio:

~~~powershell
npm --prefix backend run prisma:studio
~~~

Run the database integrity audit:

~~~powershell
npm --prefix backend run schema:audit
~~~

The current ERD and database cutover notes are available in the
[docs](docs) directory.

## Development records

Material system changes have a concise entry in `change_log.txt` and a full
engineering record in
[docs/development-change-log.md](docs/development-change-log.md). Detailed
entries cover behavior, architecture, affected roles, data and API impact,
security and accessibility considerations, validation, deployment, rollback,
limitations, and recommended follow-up work. Every detailed entry begins with
a short TL;DR for quick review.

## Application availability

Super Administrators and Administrators can control new scholarship
submissions from **Admin Panel > Settings > Application form access**. The
form can be opened or closed immediately and can optionally be limited to an
opening and closing date/time. Schedule values are entered and displayed in
Philippine Standard Time (UTC+8), while the API stores normalized timestamps
and enforces the setting for every new submission.

## Production deployment

The repository includes production configuration for a Vercel frontend,
Render API, Prisma Postgres database, and Vercel Blob file storage. Follow the
[deployment guide](docs/deployment-guide.md) for the required services,
environment variables, first deployment, and post-deployment checks.

## Repository safety

Local environment files, dependencies, compiled frontend output, generated
Prisma clients, uploads, and database exports are intentionally excluded from
Git. Never commit backend/.env or real applicant and scholar documents.
