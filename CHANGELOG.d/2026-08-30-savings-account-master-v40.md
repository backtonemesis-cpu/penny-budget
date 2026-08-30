# Savings account master and compact monthly editing

- Added Settings > Savings Accounts as the reusable master list for savings-account names.
- Existing monthly savings snapshots migrate into that master list without changing balances.
- Monthly savings snapshots select an existing savings account instead of retyping the account name.
- Master-list renames/removals do not rewrite historical month snapshot labels or balances.
- Simplified savings editing to a compact balance-only editor with small Edit/Save/Cancel/Delete controls.
- Overview Savings Snapshot routes directly to the Savings view.
- Month-only exports carry the savings-account references used by that month, and scoped imports merge those references safely.
