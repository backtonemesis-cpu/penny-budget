from pathlib import Path

month_path = Path('scripts/month-setup-source-audit.mjs')
text = month_path.read_text()
replacements = {
    "assert.match(app, /monthSetup\\.availableCount > 0/, 'Completed month setup must disappear from Overview once there is nothing left to copy.');":
    "assert.match(app, /monthSetup\\.totalAvailableCount > 0/, 'Month setup must disappear from Overview once no recurring bills or regular income remain to copy.');",
    "assert.match(app, /setToast\\(`\\$\\{copies\\.length\\}/, 'Successful recurring-bill copy must use a transient confirmation.');":
    "assert.match(app, /setToast\\(`\\$\\{copies\\.bills\\.length\\}/, 'Successful month setup must use a transient confirmation.');",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'Month setup source-audit target missing: {old}')
    text = text.replace(old, new, 1)
month_path.write_text(text)

finance_path = Path('scripts/source-audit.mjs')
finance_audit = finance_path.read_text()
old = "  assert.match(files.finance, /transferNeeded:\\s*roundMoney\\(Math\\.max\\(0, row\\.amount - row\\.currentBalance\\)\\)/, 'Account transfer planning must subtract confirmed bank balances from unpaid account costs.');"
new = "  assert.match(files.finance, /transferNeeded:\\s*ambiguousAccount \\? null : roundMoney\\(Math\\.max\\(0, row\\.amount - row\\.currentBalance\\)\\)/, 'Normal account transfer planning must subtract confirmed bank balances, while ambiguous owner-TBC accounts must remain TBC.');\n  assert.match(files.finance, /hasAmbiguousFundingAccounts/, 'Merged owner-TBC accounts used by multiple real payers must block a combined transfer total.');"
if old not in finance_audit:
    raise SystemExit('Finance source-audit transfer target missing')
finance_path.write_text(finance_audit.replace(old, new, 1))
print('Updated v10 month-setup and finance source audits')
