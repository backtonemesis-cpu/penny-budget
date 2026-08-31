# Penny Change Log — v68

## 31 August 2026 — Native-height bottom navigation

- Reduced the actual mobile bottom-navigation footprint to align much more closely with the compact iPhone proportions visible in the supplied TikTok and Messenger comparison screenshot.
- Changed the primary tab minimum touch target from 48px to the iOS-standard 44px minimum.
- Removed the v67 8px visual translation and instead shortened the real navigation container.
- Reduced the effective bottom safe-area allowance while retaining an 8px minimum guarded clearance.
- Kept the four primary tabs, icon sizes, labels, active-state styling and navigation destinations unchanged.
- No finance calculations, transaction data, savings logic, Transfer Plan logic, payment status, storage, reconciliation or affordability evidence logic was changed.
- Added a dedicated v68 regression test and CI gate.
