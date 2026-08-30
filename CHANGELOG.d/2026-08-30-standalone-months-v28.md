# Standalone months v28

- Each month now owns its own Household People, Accounts/owners and category visibility setup instead of sharing one live master setup across every month.
- Legacy Penny data migrates safely into month-scoped setup while transaction/income labels remain preserved for audit traceability.
- Reset Month now returns only the selected month to a completely blank state, including people, accounts, balances, savings snapshot, budget/setup, transactions and income; all other months remain untouched.
- Start New Month now lets the user choose which setup to carry forward: people, accounts/owners, recurring bills, recurring income, budget, category setup, bank balances and savings snapshot. Bank balances and savings are off by default. Ordinary spending, refunds, transfers, card repayments and one-off income are never copied.
- Backup export now supports the current month, a chosen month, or all Penny data.
- Backup files carry explicit scope metadata. Import automatically recognises a month-only backup and replaces only that month, or recognises a full backup and replaces the complete Penny dataset after confirmation and rollback protection.
- Added regression coverage for month independence, selective setup copying and scoped export/import.
