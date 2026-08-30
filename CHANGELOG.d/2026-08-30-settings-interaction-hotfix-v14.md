## 2026-08-30 — Settings interaction hotfix

- Fixed an event-loop regression introduced by the Settings Clear Month control that could make Penny appear frozen and prevent taps on Settings, navigation and other controls.
- The Settings month-clear label now updates only when its text actually changes, preventing the MutationObserver from triggering itself continuously.
- Clear Month remains Settings-only and keeps all existing confirmation, audit, month-scope and savings-preservation safeguards.
- No finance calculations, reconciliation rules or stored data are changed.
