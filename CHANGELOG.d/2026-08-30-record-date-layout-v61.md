# v61 — record date layout

- Moves the existing Exact date and Exact date not confirmed controls into the visible editing flow for every record mode at build time.
- Expense: Exact date now renders directly after Category and before Expense type.
- Income: Exact date now renders directly after Income type and before Received By / Account.
- Transfer: retains its Exact date controls.
- Removes the failed iOS scroll/focus date workaround from app startup.
- No finance calculations, amounts, categories, accounts, paid/received status, or stored values are changed by this presentation fix.
- Adds a regression test that fails the build if the date controls are not in the intended React layout.
