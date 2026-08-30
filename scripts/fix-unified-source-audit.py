from pathlib import Path

p = Path('scripts/source-audit.mjs')
text = p.read_text()
old = """  assert.match(files.app, /Start-of-Month Transfer Plan/);
  assert.match(files.app, /enter bank balances in Savings/);
  assert.match(files.app, /summary\\.accountFundingPlan/);
  assert.match(files.app, /Bill-Paying Bank Balances/);
"""
new = """  assert.match(files.app, /Start-of-Month Transfer Plan/);
  assert.match(files.app, /Everything needed is on this screen/);
  assert.match(files.app, /FundingBalanceEditor/);
  assert.doesNotMatch(files.app, /enter bank balances in Savings/);
  assert.doesNotMatch(files.app, /Bill-Paying Bank Balances —/);
  assert.match(files.app, /summary\\.accountFundingPlan/);
"""
if text.count(old) != 1:
    raise SystemExit(f'Expected one legacy funding audit block, found {text.count(old)}')
p.write_text(text.replace(old, new, 1))
print('Legacy source audit aligned with unified funding view')
