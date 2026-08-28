# Penny Change Log

## 28 August 2026 — June historical import finalisation

- Confirmed the current live Family Tracker uses `Joint` for shared household responsibility; Penny now displays the same term while retaining the existing internal ID for backward compatibility.
- Confirmed completed historical month imports preserve other months, month-specific savings snapshots and reconciliation metadata.
- Prepared Penny for the reconciled June 2026 month-merge package using the version-6 completed-month schema.
- No household names, accounts or currency figures are stored in this public repository.

## 28 August 2026 — Completed historical month reconciliation

- Added a distinct completed-month mode for historical evidence such as June 2026.
- Completed months now reconcile: Starting Savings + Income - Expenses = Expected Closing Savings.
- The recorded month-end savings snapshot is compared against the expected closing balance and a reconciliation variance is shown.
- Completed months no longer add their income again to an already-recorded closing savings balance.
- Overview shows Historical Reconciliation instead of live Transfer Plan / Transfer Check for completed months.
- Live months continue using Current Savings + Income - Remaining Bills Still Unpaid.
- Historical month metadata is preserved by safe month-merge imports.

## 28 August 2026 — Historical month savings and merge imports

- Changed savings balances from one global snapshot to month-specific snapshots.
- Existing version-4 savings migrate automatically to the latest month already containing Penny records.
- Added safe `merge_months` imports so a historical month can be added without replacing other months.
- Month imports replace only the specified month's transactions, income, savings snapshot and month-specific budget data.
- Household people, accounts and custom categories are merged safely by ID.
- Savings tab now clearly identifies the selected month and edits only that month's snapshot.
- Added regression tests proving a June import cannot overwrite July savings or July transactions.

## 20 July 2026 — Family Tracker alignment

- Rebuilt Penny around household cash planning rather than a generic spending ledger.
- Added Paid / Unpaid, Paid By and Account fields to expenses.
- Added Received By and Account fields to income.
- Added Current Savings by account, Remaining Bills, Transfer Plan and Transfer Check.
- Changed Projected End Savings to: Current Savings + Income This Month - Remaining Bills Still Unpaid.
- Preserved existing Penny records through version-4 migration; missing responsibility fields are marked for confirmation.
- Kept internal transfers, savings transfers and card repayments visible but excluded from expenses.
- Removed the refund entry workflow while retaining compatibility with legacy imported records.
- Added regression tests for migration, transfer planning, privacy and tracker calculations.

No household figures are stored in this public repository.
