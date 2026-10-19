# Editable Amount column acceptance — 2026-10-20

Local result: passed with synthetic fixtures. Published for testing: frontend editor assets verified live and API/database health passed. Hostinger backend revision/migration confirmation and authenticated acceptance remain pending; no direct application-database migration/write was performed by the agent.

1. Deploy the committed nullable override/constraint migration before starting the matched new backend. Confirm both frontend/backend builds and API health. Use synthetic test Scholars only.
2. In Payroll, queue an unlisted Public Scholar. Click the formatted Amount: it must become a focused, selected input directly in the cell. Cancel/Escape must leave it unchanged and restore focus to the amount; Enter/Save must submit. The separate Edit button/dialog should be absent.
3. Save PHP 4,321.09; verify the queue total, reload/requeue persistence and Amount-bearing preparation exports. Repeat in Billing for a prepared Private Scholar with PHP 3,500 tuition and a PHP 6,500.75 total: remaining allowance must be PHP 3,000.75.
4. Try blank, negative, excess-decimal and over-capacity values; reject without writes. For prepared Private records reject any total below current tuition. Verify zero using a Public or zero-tuition Private fixture.
5. Open an amount in two sessions. Save a different value in one; the stale session must receive refresh guidance and keep its typed draft without overwriting. A stale Private preparation editor must also fail after an amount change.
6. Verify staff with only Billing cannot edit a Payroll-route record, and vice versa. Applicant/Scholar roles and staff without either section must be denied.
7. Generate each official list. Check membership, totals, stored Private breakdown, downloaded Amount cells and historical re-download against saved amounts. If an edit completes after the browser queue loads, the official download must use the final server snapshot.
8. Ensure generated/history records stay locked; past custom amounts must not revert to school defaults after reload. Existing untouched records with old ignored billing_amount values must retain their current default.
9. For a synthetic Public transfer retaining an obsolete unlisted Private preparation, edit the Public amount below old tuition; the obsolete tuple should clear, documents/history should remain, and the Public record should have no Private breakdown.
10. Check keyboard focus, modal Escape/Cancel, error announcement and 320/390 px layout. Verify operational activity describes list amount edits and no receipt/release action appears.

Validation performed locally: backend 440 pass/one existing opt-in DB skip, frontend 206 pass; lint/build/Prisma schema and generated client passed; 13 embedded PostgreSQL migration/constraint checks passed; synthetic actual-component browser scenarios and serialized Excel cell assertions passed. No production records, accounts, mail or private documents used.

Scope: individual amounts for list preparation only. Defaults remain PHP 3,000 Public/PHP 5,000 Private. The existing enrollment-certification policy wording remains unchanged. Rollback should disable editing while retaining the additive column/snapshots; do not switch custom-amount records back to old fixed-total generators.

Layout follow-up: verify Amount/header alignment while editing and scrolling a long queue. There must be one queue scroll area, a sticky aligned header, no nested horizontal scrollbar and no page-wide horizontal overflow. Desktop target queue has more room; narrower screens may scroll the grid horizontally. CSS release 5439b31 was verified publicly in Dashboard-DK7nxP4A.css.
