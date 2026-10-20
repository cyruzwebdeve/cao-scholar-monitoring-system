# Reports Scholar search acceptance — 2026-10-20

Status: implemented locally, not deployed. Frontend-only; no new migration.

1. Open Reports with a staff account already authorized for the existing Reports and Scholar-management reads. Confirm the new Scholar records section loads with current accounts and known historical list entries; count is report records rather than unique Scholars.
2. Search a name, control number, current school/course/location and exact certification/payroll reference. Try mixed case, accents, extra spaces and combined terms. Search must not send extra API requests or change summary counts/coverage/graduating sections.
3. Search an earlier reference and choose its year: retain the recorded year/semester. A different year must show no results. Names, school/course and account status are current, clearly labelled. Unknown-period history is available under All School Years only.
4. Check ten-row pagination, clearing, page reset after query/year changes and useful empty results. Current list entries must not also appear as duplicate active-history entries.
5. Export matches from page two: the CSV must include all matching pages and no unmatched rows, with query/year metadata. No release/disbursement/receipt or monetary amount columns. General Export CSV must keep new Scholar columns unselected by default; explicitly selecting that group must use its filtered all-page count.
6. Check 1440/390/320 px, readable table/mobile labels, keyboard focus, labelled search/year controls and result count announcements.
7. Simulate a failed initial read: show Retry and disable export, without a false empty search table. Recover successfully on retry. Existing API permissions must not be broadened for portal or unrelated staff roles.

Local evidence: 212 frontend tests passed, including six new report cases; lint/build passed; actual-component synthetic browser search/year/history/paging/clear/export/default-selection/mobile/failure-retry checks passed. No real records or application-database writes used. Existing underlying Reports/management permission constraints remain; authenticated hosted acceptance is pending deployment.
