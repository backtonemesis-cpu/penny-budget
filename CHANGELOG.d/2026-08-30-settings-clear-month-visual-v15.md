## 2026-08-30 — Clear Month visual hierarchy

- Reworked Settings → Backup and Recovery so Clear Month is a full-width destructive action instead of a small corner control.
- Added plain-language scope text stating that only the selected month is deleted and all other Penny data is kept.
- Removed the cramped `Month data / Selected:` presentation from the visible Settings layout.
- Strengthened the confirmation wording to explicitly say the selected month only.
- Added desktop and mobile regression coverage for the full-width action and scope explanation.
- Kept the existing selected-month-only deletion logic, savings-history preservation, completed-month unlock protection and Change History audit intact.
