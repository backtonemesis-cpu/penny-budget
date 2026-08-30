# v51 — iOS black-screen hotfix

- Render Penny immediately instead of blocking the initial UI on the remote release-version check.
- Keep release/version checks running in the background.
- Prevent a slow or stalled `version.json` request from leaving the app on an empty black background.
- No financial calculations, transaction data, savings data, or affordability logic changed.
