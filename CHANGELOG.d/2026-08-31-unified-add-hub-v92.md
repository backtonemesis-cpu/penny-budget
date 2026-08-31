# Unified + Add hub v92

- `+ Add` now has three primary actions: Expense, Income and Account.
- Income and Expense can create a missing household person or spending account inline without leaving the record editor.
- Account creation supports Debit/current account, Credit card and Savings account, with an owner selected at creation time.
- Debit/current and credit-card definitions are stored only in the selected month's account setup. Savings definitions are stored in that month's Savings snapshot with an opening balance of £0.00.
- Account type is metadata only in this release; existing finance, Transfer Plan and card-payment accounting rules are unchanged.
- Duplicate person/account names for the selected month are blocked in the new Add flow.
- Settings remains available for advanced/administrative management but is no longer required before a fresh month can be entered manually.
- Added v92 regression coverage. No historical transactions, income, balances or prior-month setup are rewritten.
