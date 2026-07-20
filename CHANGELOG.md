# Penny Change Log

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
