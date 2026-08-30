# v55 — Safe Cash-flow removal

- Removed the unsafe JavaScript DOM deletion that could crash React when switching months.
- The legacy Cash-flow calculation disclosure is now hidden from the Overview without deleting React-owned DOM nodes.
- Month switching remains under React control.
- Financial calculations, stored transactions, income, savings and reconciliation logic are unchanged.
