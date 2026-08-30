## 2026-08-30 — Compact transfer header and confirmed month clearing

- Compressed the mobile Start-of-Month Transfer Plan header so it no longer consumes several lines of vertical space.
- Added a compact Clear <Month> action on Overview.
- Clearing requires explicit confirmation and removes only the selected month's transactions, income, current bank-balance entries, month-specific budget/setup data and completed-month status.
- Other months, household references, categories and savings history are preserved.
- Completed historical months must first be unlocked through the existing correction-unlock control.
- The clear operation is recorded as one Change History event with the pre-clear month snapshot retained for audit traceability.
- Added a dedicated clear-month safety regression to CI.
