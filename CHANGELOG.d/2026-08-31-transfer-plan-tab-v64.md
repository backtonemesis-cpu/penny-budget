## v64 — Dedicated Transfer Plan tab

- Moved the full Start-of-Month Transfer Plan out of Overview into its own primary Transfer Plan tab.
- Kept a compact Transfer needed summary on Overview that opens the dedicated plan.
- Reused the existing per-account planned-cost, current-bank-balance and transfer-needed logic without changing finance calculations or stored data.
- Used the fourth bottom-navigation slot for Transfer Plan and added regression coverage for the move.
