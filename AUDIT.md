# Penny Audit Standard

This document defines the release checklist for the browser-local Penny application. It contains no household figures or identities.

## Accounting integrity

- All currency calculations are rounded to pennies.
- Net saving is Income minus Expenses.
- Live projected end is Savings Snapshot plus Net Saving.
- A completed month stops at its recorded closing savings and is never projected forward a second time.
- Completed months reconcile Starting Savings + Income - Expenses against Recorded Closing Savings.
- Internal transfers, savings transfers and card repayments stay visible for audit but are excluded from expenses.
- New expenses default to Unpaid.
- Duplicate-looking records require explicit user confirmation before a second identical record can be saved.

## Evidence integrity

- Unknown dates are shown as Date TBC; the internal first-of-month placement date is never presented as confirmed evidence.
- Unknown payer, receiver or account assignments remain explicitly unresolved until confirmed.
- Historical person/account labels are snapshotted on records so later reference renaming does not rewrite old evidence.
- Completed months are locked by default and require an explicit correction unlock for the current session.
- Financial edits and deletions are recorded in local Change History with before/after evidence where applicable.
- Year view exposes unresolved records and month reconciliation status.

## Recovery and privacy

- Browser state that cannot be parsed enters protected recovery mode and is not silently overwritten.
- Imports create an automatic rollback copy only after the user approves the import.
- Future-format backups are rejected until the app is updated.
- Household figures and identities are not embedded in the public repository.
- A restrictive Content Security Policy blocks third-party scripts, objects and referrer leakage.

## Engineering gates

- `npm ci` must succeed from the committed lockfile.
- Production dependencies must have no known audit vulnerabilities.
- Development/build dependencies must have no moderate, high or critical audit vulnerabilities.
- Finance/storage regression tests must pass.
- Accessibility, storage, privacy, currency and finance source audits must pass.
- Production build must pass.
- Cross-platform lockfile integrity is checked for the repaired Darwin binding and patched PostCSS release.

## Scope boundary

This checklist rates the current **browser-local** Penny implementation. Cross-device cloud synchronisation is a separate architecture feature requiring authenticated private backend storage and is not represented as implemented until such a backend exists.
