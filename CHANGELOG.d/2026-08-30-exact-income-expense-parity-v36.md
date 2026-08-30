# Exact income and expense visual parity

- Transactions > Expenses now uses the same mobile row geometry as Transactions > Income.
- Removed the expense icon column from the compact ledger so title and amount occupy the same top row as Income.
- Expense amount is fixed to the top-right and no longer moves below metadata for large values.
- Paid/Unpaid badges, metadata, dividers and action buttons now follow the same spacing and dimensions as Income.
- Dedicated Expense Detail receives the same mobile geometry as dedicated Income Detail.
- Added regression coverage for normal and narrow-phone layouts, including large amounts.
- No finance logic, stored records or calculations changed.
