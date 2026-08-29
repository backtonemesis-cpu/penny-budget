# Penny Change Log

## 28 August 2026 — Audit hardening and mobile UX rebuild

- Preserved backward compatibility for completed months that already contain a valid starting-savings value while keeping genuinely missing starting-savings evidence as `TBC`; an explicit £0 remains valid evidence.

- Corrected completed-month display logic so recorded closing savings is never projected forward a second time.
- Added penny-safe rounding helpers to prevent floating-point drift in financial totals.
- Added structured confirmation issues so unknown dates, payer/receiver and account evidence remain unresolved until explicitly confirmed.
- Historical records with unknown exact dates now display `Date TBC` instead of presenting the technical month-placement date as fact.
- New expenses now default to Unpaid rather than assuming payment.
- Added duplicate detection: a matching expense or income record now requires explicit confirmation before a second identical record can be saved.
- Completed months are locked against accidental editing by default and require an explicit correction unlock for the current session.
- Added local Change History with before/after snapshots for financial edits and deletion before-state retention.
- Historical record person/account labels are snapshotted so later reference renaming does not rewrite how old evidence is displayed.
- Tightened evidence status: only completed, fully confirmed and reconciled months can be `Ready`; live data is `In progress`, failed completed evidence is `Review`, and empty periods are `No data`.
- Prevented the selected historical month from automatically jumping back to the current month when Penny becomes visible.
- Added protected recovery mode when local browser state cannot be parsed or was created by a newer Penny data format, preventing saved data from being silently overwritten.
- Normal backup export is disabled during protected recovery so the blank in-memory fallback cannot be mistaken for the unreadable saved state.
- Added automatic pre-import rollback storage and a one-click restore option. The rollback is created only after the user approves an import.
- Future-format backup wrappers and raw future-version Penny states are rejected until Penny is updated.
- Reduced Overview vertical weight, collapsed cash-flow detail, and hides the large Transfer Plan when nothing remains unpaid.
- Currency figures no longer wrap in the middle of a number on mobile.
- Increased navigation label size and touch targets; modals now trap keyboard focus and restore it to the opener when closed.
- Added a restrictive same-origin Content Security Policy and no-referrer policy.
- Patched the remaining moderate PostCSS build-tool advisory and raised the dependency gate to reject moderate-or-higher vulnerabilities.
- Updated GitHub checkout/setup actions for the Node 24 workflow runtime.
- Expanded regression/source audits for accounting logic, evidence status, data provenance, duplicates, recovery, accessibility, dependency security and privacy.

## 28 August 2026 — Corrected live savings projection

- Corrected live-month Projected End Savings to: Current Savings + Saved This Month.
- Saved This Month remains Income - all recorded Expenses, so expenses are counted exactly once.
- Projected Increase now equals Saved This Month and is independent of payment-status toggles.
- Remaining Bills and Transfer Plan remain funding-status information; they no longer replace net monthly saving in the projection.
- Added regression and source-audit gates preventing the superseded Current Savings + Income - Remaining Bills formula from returning.

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
- This live-month formula was superseded on 28 August 2026 by Current Savings + Saved This Month.
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
- The original live projection formula was superseded on 28 August 2026 by Current Savings + Saved This Month.
- Preserved existing Penny records through version-4 migration; missing responsibility fields are marked for confirmation.
- Kept internal transfers, savings transfers and card repayments visible but excluded from expenses.
- Removed the refund entry workflow while retaining compatibility with legacy imported records.
- Added regression tests for migration, transfer planning, privacy and tracker calculations.

No household figures are stored in this public repository.
