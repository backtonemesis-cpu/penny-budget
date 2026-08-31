# v85 — Critical testing fixes

- Restores the shared Description and Amount fields in both Income and Expense entry. The v45 Transfer cleanup had accidentally removed those shared fields while leaving their validation active.
- Makes the Savings setup hint depend on the accounts actually displayed for the selected month, so it no longer tells users to add accounts when monthly accounts are already present.
- Preserves an explicitly selected month across same-tab release reloads using session-only state, preventing a selected September view from snapping back to the current month.
- Keeps backup download object URLs alive briefly after the download click and shows a `Backup download started.` confirmation.
- Gives new and existing account-name fields distinct accessible names, and distinguishes the new account-owner control.
- Retains v84 inline User/Account assignment dropdowns, owner filtering and month-rollover assignment carry-forward.
- No finance totals, transaction arithmetic, savings calculations or historical month figures are intentionally changed.
