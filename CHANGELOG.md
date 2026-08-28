# Penny Change Log

## 28 August 2026 — Historical month savings and merge imports

- Changed savings balances from one global snapshot to month-specific snapshots.
- Existing version-4 savings migrate automatically to the latest month already containing Penny records.
- Added safe `merge_months` imports so a historical month can be added without replacing other months.
- Month imports replace only the specified month's transactions, income, savings snapshot, closed-month metadata and month-specific budget data.
- Added closed historical month reconciliation: Opening Savings + Income - Expenses = Ending Savings.
- Closed months show actual ending savings and a reconciliation view instead of applying the live transfer projection retrospectively.
- Household people, accounts and custom categories are merged safely by ID.
- Savings tab now clearly identifies the selected month and edits only that month's snapshot.
- Updated the special shared payer label to `Joint` to match the current Family Tracker terminology while preserving the existing internal ID for old Penny data.
- Added regression tests proving a June import cannot overwrite another month's savings or transactions.

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
