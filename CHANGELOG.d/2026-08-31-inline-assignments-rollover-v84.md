# v84 — Inline assignments and reliable month rollover

- Replaced ambiguous `Unassigned · Unassigned` transaction-card controls with direct inline dropdowns labelled by context: `Paid by` / `Received by`, plus `User` and `Account` placeholders.
- Assigned values remain directly changeable from the card; missing values stay highlighted in amber.
- Added owner-aware account filtering so a payer/recipient cannot accidentally be paired with an incompatible owner-specific account.
- Fixed Set Up Month so a blank target month carries the prior month's people and account setup rather than dropping valid assignments.
- Added evidence-based rollover resolution using stored person/account labels when historical IDs no longer match current month-scoped references.
- Stabilised recurring income dedupe on visible recipient/account evidence, matching the v83 recurring-bill protection and preventing repeat setup imports after account-reference repair.
- No finance totals, savings calculations, reset behaviour, desktop month picker, or stored historical month figures were intentionally changed.
