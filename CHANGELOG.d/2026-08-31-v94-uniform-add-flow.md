## 2026-08-31 — Uniform Add chooser and Settings-only cleanup

- Changed the header `+ Add` button to open a chooser first instead of immediately opening the People form.
- Prevented People and Accounts forms from auto-focusing text fields, so the iPhone keyboard stays closed until a field is deliberately tapped.
- Made People, Accounts, Income and Expense use the same wide Add layout and a larger, consistent section navigation treatment.
- Added a full-width mobile Add chooser with large People, Accounts, Income and Expense actions.
- Removed visible cross-entry shortcuts such as `+ Add person` from Accounts and the People/Account quick-setup controls from Income and Expense; each setup type now stays in its own area.
- Removed the remaining Savings Accounts setup section from Settings. Settings remains for configuration/recovery rather than recording people or account definitions.
- Left finance calculations, saved transactions, month-scoped people/accounts, savings balances, reconciliation and historical evidence unchanged.
- Added v94 regression coverage for chooser-first behaviour, no auto-focus, uniform Add layout and Settings-only account setup removal.
