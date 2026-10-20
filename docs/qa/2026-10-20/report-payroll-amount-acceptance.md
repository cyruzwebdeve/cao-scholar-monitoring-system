# Payroll amount reporting and Reports layout — 2026-10-20

Status: implemented locally, not deployed. User confirmed generated payroll-list amounts, retaining the approved scope. No new API/backend/migration.

1. Reports should open with readable Scholar search, school-year/list-status filters, four payroll summary cards and the individual amount table. Coverage/program metrics remain in a separately labelled section below.
2. Use saved payroll memberships with known grant/tuition/allowance snapshots. Totals must equal those saved amounts, prefer current-period membership snapshots over current/default projections, and include inactive Scholars’ recorded lists when matched.
3. Certification and unlisted/proposed values must not contribute payroll amounts. Current/history duplicates must count once; Scholar and list counts must be distinct while entry counts retain separate periods.
4. Missing, invalid, partial or inconsistent allocation tuples must show Not recorded with complete-entry coverage; never infer allowance from current Public/Private classification. Known zero tuples must show PHP 0.00. Missing total amounts must be identified rather than silently interpreted as zero.
5. Change name/control/reference search, school year and list status; cards, table and matching CSV must use the same matching records across every page. Coverage metrics remain independent of query/list-status filtering.
6. Export matches: verify individual monetary cells, totals and missing-value metadata. In general Export CSV choose only Scholar Name: no monetary columns or financial summary rows should appear. Existing default coverage/graduating exports stay unchanged.
7. Verify desktop sticky headers/scrolling and right-aligned amounts; at 390/320 px use readable stacked records/cards without page overflow. Check labels, keyboard focus, count/status notices, disabled unavailable data and failed-load retry.
8. No money-released, received/claimed, disbursement-confirmed or reconciliation action/status should be added. No real business writes are needed for this read-only acceptance check.

Local evidence: frontend 217 tests plus lint/build passed; 11 focused report tests and actual-component synthetic amount/filter/export/default-selection/failure/mobile checks passed. Authenticated hosted acceptance remains pending publication.
