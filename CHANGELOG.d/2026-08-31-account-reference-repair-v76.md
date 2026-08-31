# v76 — Owner-specific account reference repair

- Repairs fixed-expense account references that became `TBC · Unassigned` after a legacy account ID was removed or replaced.
- Reconnects a record only when Penny has unambiguous evidence from the payer, saved account label and/or matching previous-month recurring expense.
- Supports owner-specific accounts such as `Lloyds Marius` and `Lloyds Vesta` without merging their balances or transfer requirements.
- Keeps genuinely ambiguous account references as TBC rather than guessing.
- Preserves all amounts, dates, categories, paid/unpaid status, income and savings values; only the broken account reference and its `account` confirmation issue are repaired.
- Writes automatic account-reference repairs into Change History with before/after evidence.
- Future recurring-bill copies now resolve a uniquely matching owner-specific account instead of discarding the account reference.
- Replaces the misleading/broken “Separate accounts” prompt for unresolved TBC rows with an explicit account-confirmation instruction.
