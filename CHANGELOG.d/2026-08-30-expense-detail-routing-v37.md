# Expense Detail routing v37

- Fixed the Overview Expenses card so it opens the dedicated Expense Detail screen instead of the general Transactions menu.
- Corrected the build-time migration anchor to match the actual v32 route marker.
- Added fail-closed verification so a legacy Expenses-to-Transactions route cannot silently survive a production build.
- Kept Expense Detail visually aligned with Income Detail and retained payment status, edit, delete, payer/account evidence and reconciliation total.
