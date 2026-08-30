from pathlib import Path

path = Path('scripts/month-setup-source-audit.mjs')
text = path.read_text()
replacements = {
    "assert.match(app, /monthSetup\\.availableCount > 0/, 'Completed month setup must disappear from Overview once there is nothing left to copy.');":
    "assert.match(app, /monthSetup\\.totalAvailableCount > 0/, 'Month setup must disappear from Overview once no recurring bills or regular income remain to copy.');",
    "assert.match(app, /setToast\\(`\\$\\{copies\\.length\\}/, 'Successful recurring-bill copy must use a transient confirmation.');":
    "assert.match(app, /setToast\\(`\\$\\{copies\\.bills\\.length\\}/, 'Successful month setup must use a transient confirmation.');",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'Source-audit target missing: {old}')
    text = text.replace(old, new, 1)
path.write_text(text)
print('Updated month setup source audit for bills plus regular income')
