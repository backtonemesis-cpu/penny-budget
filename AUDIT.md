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

- **Ready** is reserved for completed months with a savings snapshot, no unresolved evidence fields, no unpaid items at close, and a clean reconciliation.
- Live months with data are **In progress**, never Ready, even when every currently entered field is confirmed.
- Completed months that fail an evidence or reconciliation check are **Review**.
- Empty periods are **No data**, not Review or Ready.
- Unknown dates are shown as Date TBC; the internal first-of-month placement date is never presented as confirmed evidence.
- Unknown payer, receiver or account assignments remain explicitly unresolved until confirmed.
- Internal transfers, savings transfers and card repayments require an assigned account; unresolved movement evidence prevents a completed month from being **Ready** even though the movement is excluded from spending.
- Historical person/account labels are snapshotted on records so later reference renaming does not rewrite old evidence.
- Completed months are locked by default and require an explicit correction unlock for the current session.
- Financial edits and deletions are recorded in local Change History with before/after evidence where applicable.
- Year view separates in-progress months, completed months needing review, unresolved records and reconciliation failures.

## Recovery and privacy

- Browser state that cannot be parsed enters protected recovery mode and is not silently overwritten.
- Local state created by a newer Penny data format is also protected from overwrite by an older app build.
- Normal backup export is disabled during protected recovery because the blank in-memory fallback is not the unreadable saved state.
- Imports create an automatic rollback copy only after the user approves the import and while the current local state is healthy.
- Future-format backup wrappers and raw future-version Penny states are rejected until the app is updated.
- Household figures and identities are not embedded in the public repository.
- A restrictive Content Security Policy limits scripts, styles, network connections, objects and referrer leakage to the Penny origin.

## Accessibility and mobile UX

- Pinch zoom remains available.
- Primary controls retain at least 44px touch targets.
- Currency values do not break in the middle of a figure on narrow screens.
- Modal focus is trapped while open and restored to the previous control when the modal closes.
- Mobile navigation labels remain legible at supported phone widths.
- Zero-value Transfer Plan content collapses rather than occupying a large empty card.

## Engineering gates

- `npm ci` must succeed from the committed lockfile.
- Production dependencies must have no known audit vulnerabilities at moderate severity or above.
- Development/build dependencies must have no moderate, high or critical audit vulnerabilities.
- Finance/storage and final evidence/recovery regression tests must pass.
- Accessibility, storage, privacy, currency and finance source audits must pass.
- Production build must pass.
- The patched PostCSS release and existing NanoID security override remain locked and audited.
- GitHub Actions use the current Node 24-compatible checkout/setup actions.

## Scope boundary

This checklist rates the current **browser-local** Penny implementation. Cross-device cloud synchronisation is a separate architecture feature requiring authenticated private backend storage and is not represented as implemented until such a backend exists.
