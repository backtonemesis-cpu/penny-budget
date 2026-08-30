## 2026-08-30 — Settings viewport repair

- Removed the visible App Version card from Settings; release checking still runs internally and continues to protect browser-stored finance data.
- Constrained the Settings sheet to the real iPhone viewport/dynamic viewport and disabled iOS text inflation inside the sheet so the right edge and Done button cannot be pushed off-screen.
- Removed repetitive disabled `In use` controls from the visible layout while keeping the underlying reference-deletion protection unchanged.
- Reworked mobile account rows to prioritise account name + owner in one safe responsive row; Remove appears only when the reference is actually removable.
- Reduced backup/category visual weight further and kept all financial, reconciliation, storage, audit and recovery logic unchanged.
- Added a dedicated Settings viewport regression test and CI gate for these protections.

## 2026-08-30 — Settings menu cleanup

- Reworked the iPhone Settings screen to reduce visual clutter and scrolling without changing any finance or evidence logic.
- Put each household person on one compact row and each account on one compact row containing account name, owner and protected `In use` status/action.
- Reduced routine explanatory copy, tightened section spacing and modal/header padding, and compressed the app-version strip.
- Changed the category icon picker from a tall multi-row grid to a horizontal scroll strip while keeping category creation and management available.
- Reduced Change History and Backup/Recovery visual weight; destructive erase remains clearly marked and still requires confirmation.
- Strengthened the Settings regression audit so future releases must preserve the compact account rows, status treatment, category strip, backup controls and recovery safeguards.
- Finance calculations, reconciliation, month selection, stored household data and historical evidence were not changed.

## 2026-08-30 — Settings menu full audit and mobile optimisation

- Audited Settings end to end: household people, explicit account ownership, category protection, Change History, app-version reporting, backup export/import, automatic pre-import rollback, protected recovery mode and local-data erase.
- Added a dedicated Settings CI audit covering reference-in-use deletion locks, audit before/after snapshots, backup round-tripping, rollback restore/cleanup, explicit erase behaviour and modal accessibility safeguards.
- Reworked the iPhone Settings presentation into compact card-like sections with tighter spacing, a compact app-version strip, two-stage account rows, denser category controls, two-column backup actions and single-column audit snapshots.
- Kept finance calculations, month-selection logic, reconciliation, household data and stored evidence unchanged.

## 2026-08-30 — Compact mobile header proportions

- Reduced the mobile Penny wordmark, Settings width, `+ Add` width, header side padding and inter-control gaps to give the month selector substantially more room.
- Kept the full `+ Add` label while tightening its typography and padding.
- Forced the Settings gear toward a smaller text-style glyph rather than an oversized emoji presentation.
- Preserved month selection, finance calculations, storage, reconciliation and household data unchanged.

## 2026-08-30 — Full mobile month label

- Removed iPhone month-input chrome that was reserving horizontal space and clipping the year.
- Centred the native month/year text across the full month-control width and tightened the narrow-iPhone text sizing.
- Kept the month picker functional and preserved the separate Settings and `+ Add` controls.
- Added regression coverage; no finance, storage, reconciliation or month-selection logic changed.

## 2026-08-30 — Mobile header control separation

- Rebuilt the mobile header into explicit layout tracks so the month selector, Settings button and `+ Add` button cannot overlap on iPhone.
- Constrained the native month input to its own track and preserved a visible keyboard-focus treatment on the month control.
- Added narrow-iPhone sizing and mobile layout regression coverage.
- Kept the selected-month logic, finance calculations, storage, reconciliation and household data unchanged.

## 2026-08-30 — iPhone foreground update verification

- Penny now checks the live release whenever the installed app returns to the foreground, not only on initial JavaScript startup.
- Added a visible App Version section in Settings so the running release can be verified on-device.
- Update checks keep using no-store version requests and do not clear browser-stored finance data.

## 2026-08-30 — Simplified navigation and removed duplicate views

- Removed the duplicate Bills top-level tab; fixed bills now live only in Transactions → Expenses.
- Added an Expense type filter in Transactions for All expenses, Fixed bills and Variable spending.
- Removed the repeated detailed Income and Expense breakdown lists from Overview.
- Kept Overview focused on summary figures, month setup, transfer planning and reconciliation.
- Reduced the mobile navigation to four clear destinations: Overview, Transactions, Savings and Year.

## 2026-08-30 — Root overscroll lock

- Stopped the browser document from being Penny’s vertical scroll container on iPhone.
- Locked `html`, `body` and `#root` to the viewport and made `.app` the single page-level vertical scroll container.
- Kept native momentum scrolling inside Penny while suppressing top/bottom scroll chaining and rubber-band overscroll outside the app.
- Preserved modal scrolling, safe-area spacing, fixed bottom navigation and all finance/data logic.
- Extended the mobile layout regression test to require the root lock and single app scroll container.

## 2026-08-30 — Mobile editor horizontal gesture lock

- Locked the modal scroll container to vertical movement on iPhone so the transaction editor cannot be dragged left or right.
- Added explicit horizontal overflow clipping, horizontal overscroll suppression and vertical-only touch panning for the modal sheet.
- Kept the existing safe-area-aware vertical scrolling and sticky Save/Cancel action bar.
- Added a regression test for horizontal modal panning. No finance calculations or household data were changed.

## 2026-08-30 — Mobile bottom navigation stability

- Disabled root overscroll chaining in Penny so iPhone rubber-band gestures do not pull the bottom navigation away from the viewport.
- Clipped horizontal overflow at the app/root level so left/right swipes cannot make the navigation drift sideways.
- Promoted the fixed bottom navigation to its own compositor layer and removed the live backdrop blur that could jitter during Safari scrolling.
- Kept safe-area padding, navigation size, labels and all finance/data logic unchanged.

## 2026-08-30 — Mobile transaction editor repair

- Removed the nested/double-scroll modal layout that could break the transaction editor on iPhone Safari/PWA.
- Made the editor height safe-area aware and kept the form inside one controlled touch-scroll container.
- Kept Save/Cancel reachable with a sticky mobile action bar and constrained form controls to the sheet width.
- No finance calculations, transaction data, categories, account rules or historical records were changed.

## 2026-08-30 — Owner-specific accounts and regular income carry-forward

- Prevented TBC same-bank accounts used by multiple payers from being treated as one funding pot.
- Added a reviewable selected-month account split that creates owner-specific accounts without rewriting historical months.
- Start New Month now carries regular income templates as Expected: Child Benefit/Child Maintenance keep their expected amount; wages and variable benefits require the new month amount to be confirmed.
- Added Expected/Received income status and Amount TBC support; completed evidence cannot be Ready while expected/TBC income remains.
- Monthly budget settings are copied forward when present, but current bank balances and actual day-to-day spending are never copied.

## 2026-08-30 — Overview cleanup

- Replaced persistent routine success cards with an auto-dismissing confirmation toast.
- Removed the routine live-month "In progress" banner from Overview.
- Date-only TBC flags created by Start New Month no longer generate a large live-month warning; the audit flags remain on the records and still count for final evidence.
- Start New Month now appears only when recurring bills are actually available to copy and disappears after setup is complete.
- Condensed the month setup prompt to keep Overview dashboard-first.

## 2026-08-30 — Unified month setup and funding

- Moved bill-paying bank balance entry into the Overview transfer plan so the complete month-end funding workflow is on one screen.
- Added Start New Month preview/copy for recurring fixed bills from the previous month.
- Copied bills always start Unpaid and Exact date TBC; income, variable spending and transfers are never copied.
- Added reducer-level duplicate protection and one audit-history event for each month setup.
- Clearing a bank-balance input returns it to TBC instead of silently confirming zero.

# Penny Change Log

## 29 August 2026 — Explicit bank-account ownership

- Added an Owner field to every bill-paying account using local household person, Joint or TBC references.
- Existing accounts migrate to Owner TBC; Penny never infers ownership from transaction usage.
- Account ownership is visible in Settings, account choices, Transactions, Bills, Savings and the Start-of-Month Transfer Plan.
- New financial records snapshot the account owner alongside the account label so later owner changes do not rewrite historical evidence.
- Monthly bank-balance snapshots preserve ownership metadata for transfer planning.
- Month imports may fill a TBC owner from explicit evidence but cannot overwrite an already-confirmed owner.
- Account-owner edits are recorded in Change History.
- No household identities or private ownership assignments are embedded in the public repository.

## 29 August 2026 — True transfer shortfall planning

- Added monthly bill-paying bank balance snapshots so Penny can calculate how much already sits in each spending account before a savings top-up.
- Updated the Start-of-Month Transfer Plan to show planned unpaid costs, current bank balance and true transfer needed per account.
- Marked transfer totals as `TBC` when a required bank balance has not been entered, instead of treating missing evidence as a confirmed zero.
- Preserved bank-balance snapshots through backups and month-merge imports.
- Kept this as a planning-only layer; income, expense, savings projection and completed-month reconciliation logic were not changed.
- Added regression and source-audit checks for bank-balance snapshots and shortfall calculation.

## 29 August 2026 — Start-of-month account funding view

- Added a Start-of-Month Transfer Plan on Overview for live planning months.
- The plan groups unpaid bills and expenses by the bank account they will be paid from, so month-end savings transfers can be prepared account by account.
- Kept the payer breakdown visible inside each account row for audit traceability.
- No schema migration, projection formula, income treatment, expense treatment or completed-month evidence logic was changed.
- Added regression and source-audit checks for the account-level funding plan.

## 28 August 2026 — Audit hardening and mobile UX rebuild

- Preserved backward compatibility for completed months that already contain a valid starting-savings value while keeping genuinely missing starting-savings evidence as `TBC`; an explicit £0 remains valid evidence.
- Corrected completed-month display logic so recorded closing savings is never projected forward a second time.
- Added penny-safe rounding helpers to prevent floating-point drift in financial totals.
- Added structured confirmation issues so unknown dates, payer/receiver and account evidence remain unresolved until explicitly confirmed.
- Tightened excluded-movement evidence: internal transfers, savings transfers and card repayments now require an assigned account and can block `Ready` status when unresolved.
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
