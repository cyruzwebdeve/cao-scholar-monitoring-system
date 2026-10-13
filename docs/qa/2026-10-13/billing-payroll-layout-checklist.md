# Billing and Payroll Layout Verification — 2026-10-13

Release 532b506: frontend stylesheet verified live; API/database healthy.

1. Hard-refresh Billing and Payroll.
2. On desktop, confirm each control number aligns with the scholar name, the school appears beneath the name, and status badges occupy their own column.
3. Confirm the scholar name is more prominent than the school and both can wrap without overlapping status labels.
4. Confirm green readiness and amber **Requirements incomplete** badges remain distinguishable and readable.
5. On mobile/narrow panels, confirm records stack, header actions remain reachable, and the source list does not require horizontal scrolling.
6. Select a scholar with the keyboard and use the existing bulk transfer controls; confirm selected styling and footer counts still work.
7. Confirm inactive scholars remain disabled, changing periods clears the queue, and Billing's Edit dialog still works.
8. Use synthetic/test records for any list generation. Incomplete requirements should still be allowed without override reasons; document approvals should remain unchanged.

Frontend layout only: no database migration or backend behavior change.
