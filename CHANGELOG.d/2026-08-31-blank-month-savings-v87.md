## 2026-08-31 — Blank-month savings reset v87

- Fixed Reset Month so a deliberately blank month stays blank after reload even when reusable savings-account names still exist globally for other months.
- Root cause: the state migration treated the current savings-account master list as legacy monthly savings data whenever the last monthly savings snapshot had been removed, which recreated Chase/Santander/Cash after reset.
- Current-version data no longer hydrates a monthly savings snapshot from the reusable master list; legacy pre-v12 data can still migrate once for backwards compatibility.
- Reset Month continues to remove only the selected month’s savings snapshot and leaves other months and reusable master names intact.
- Added a regression test covering both a current-version blank month and legacy migration.
- No income, expense, transaction, transfer-plan, reconciliation or historical month figures were changed.
