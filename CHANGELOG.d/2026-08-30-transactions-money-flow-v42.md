# 2026-08-30 — Transactions money flow v42

- Reordered the Transactions tabs to Income → Expenses → Savings.
- Moved Savings into Transactions and removed Savings as a separate bottom-navigation destination.
- Overview Income, Expenses and Savings cards now open the matching Transactions sub-tab directly.
- Kept transfers, savings transfers and card repayments available in a secondary audit-only disclosure instead of a primary tab.
- Hid transaction filters while viewing Savings so the monthly savings snapshot keeps its clean detail layout.
- Added regression coverage for routing, tab order, primary navigation and preservation of excluded movements.
