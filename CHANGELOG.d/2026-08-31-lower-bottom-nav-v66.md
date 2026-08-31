## v66 — Lower iPhone bottom navigation

- Reduced the unused vertical space beneath the four primary navigation labels by trimming 14px from Penny's bottom safe-area allowance on devices that report a large iPhone home-indicator inset.
- Kept the existing 48px tab touch targets, icon sizes, labels, four-tab navigation and active-state styling unchanged.
- Preserved a guarded bottom clearance for the iPhone home indicator rather than removing safe-area handling entirely.
- No finance calculations, transaction data, storage, payment status, transfer-plan logic or affordability evidence logic changed.
