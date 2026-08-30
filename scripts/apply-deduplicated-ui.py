from pathlib import Path
import re

APP = Path('src/App.jsx')
MOBILE = Path('src/mobile-navigation.css')
AUDIT = Path('scripts/source-audit.mjs')
CHANGELOG = Path('CHANGELOG.md')
VERSION = Path('public/version.json')
MANIFEST = Path('public/manifest.webmanifest')

app = APP.read_text()

# Overview should remain a summary/workflow screen, not repeat detailed record lists.
old_overview_prop = '''            categoryMap={categoryMap}\n            peopleMap={peopleMap}'''
new_overview_prop = '''            peopleMap={peopleMap}'''
if old_overview_prop not in app:
    raise SystemExit('Overview categoryMap prop target missing')
app = app.replace(old_overview_prop, new_overview_prop, 1)

old_sig = "function Overview({ summary, month, year, categoryMap, peopleMap, accountMap, monthKey, monthSetup, canEditMonth, onUnlockMonth, onStartNewMonth, onUpdateBankBalance, onAddIncome, onAddExpense, onSeparateAccount }) {"
new_sig = "function Overview({ summary, month, year, peopleMap, accountMap, monthKey, monthSetup, canEditMonth, onUnlockMonth, onStartNewMonth, onUpdateBankBalance, onAddIncome, onAddExpense, onSeparateAccount }) {"
if old_sig not in app:
    raise SystemExit('Overview signature target missing')
app = app.replace(old_sig, new_sig, 1)

calc_block = '''  const categoryTotals = {};\n  summary.expenseTransactions.forEach((transaction) => {\n    categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + transaction.amount;\n  });\n  const incomeTotals = {};\n  summary.incomeRecords.forEach((record) => {\n    const key = `${record.incomeType}::${record.receivedBy}::${record.receivedByLabel || ''}`;\n    incomeTotals[key] = (incomeTotals[key] || 0) + record.amount;\n  });\n'''
if calc_block not in app:
    raise SystemExit('Overview duplicate totals block missing')
app = app.replace(calc_block, '', 1)

app = app.replace('Open Bills or Transactions to confirm the missing evidence.', 'Open Transactions to confirm the missing evidence.', 1)

# Remove duplicate detailed income/expense breakdowns from Overview.
pattern = re.compile(r'''\n      <div className="two-column-sections">.*?\n      </div>\n    </>\n  \);\n}\n\nfunction FundingBalanceEditor''', re.S)
app, count = pattern.subn('''\n    </>\n  );\n}\n\nfunction FundingBalanceEditor''', app, count=1)
if count != 1:
    raise SystemExit(f'Overview duplicate breakdown removal count={count}')

# Remove the duplicate top-level Bills view.
bills_render = '''\n        {view === 'Bills' && (\n          <Bills\n            summary={summary}\n            categoryMap={categoryMap}\n            peopleMap={peopleMap}\n            accountMap={accountMap}\n            canEdit={canEditMonth}\n            onTogglePaid={togglePaid}\n            onEdit={(transaction) => openRecord({ mode: 'expense', transaction })}\n            onAdd={() => openRecord({ mode: 'expense', presetClass: 'fixed' })}\n          />\n        )}\n'''
if bills_render not in app:
    raise SystemExit('Bills render block missing')
app = app.replace(bills_render, '\n', 1)

old_nav = "{['Overview', 'Transactions', 'Bills', 'Savings', 'Year'].map((item) => ("
new_nav = "{['Overview', 'Transactions', 'Savings', 'Year'].map((item) => ("
if old_nav not in app:
    raise SystemExit('Primary nav list target missing')
app = app.replace(old_nav, new_nav, 1)

# Remove Bills component entirely: fixed costs remain available via Transactions filter.
pattern = re.compile(r'''\nfunction Bills\(\{.*?\n}\n\nfunction StartNewMonthModal''', re.S)
app, count = pattern.subn('\nfunction StartNewMonthModal', app, count=1)
if count != 1:
    raise SystemExit(f'Bills component removal count={count}')

# Preserve the useful Bills-only workflow as a filter inside the canonical Transactions view.
old_state = "  const [paidFilter, setPaidFilter] = useState('all');\n  const text = search.toLowerCase();"
new_state = "  const [paidFilter, setPaidFilter] = useState('all');\n  const [expenseClassFilter, setExpenseClassFilter] = useState('all');\n  const text = search.toLowerCase();"
if old_state not in app:
    raise SystemExit('Transactions filter state target missing')
app = app.replace(old_state, new_state, 1)

old_filter_logic = '''    const paidMatches = paidFilter === 'all' || (paidFilter === 'paid' ? transaction.paid : !transaction.paid);\n    return matches && paidMatches;'''
new_filter_logic = '''    const paidMatches = paidFilter === 'all' || (paidFilter === 'paid' ? transaction.paid : !transaction.paid);\n    const classMatches = expenseClassFilter === 'all' || transaction.expenseClass === expenseClassFilter;\n    return matches && paidMatches && classMatches;'''
if old_filter_logic not in app:
    raise SystemExit('Transactions expense filter logic target missing')
app = app.replace(old_filter_logic, new_filter_logic, 1)

paid_filter_block = '''          <div className="field compact-field">\n            <label htmlFor="paid-filter">Payment status</label>\n            <select id="paid-filter" value={paidFilter} onChange={(event) => setPaidFilter(event.target.value)}>\n              <option value="all">All</option>\n              <option value="paid">Paid</option>\n              <option value="unpaid">Unpaid</option>\n            </select>\n          </div>'''
replacement_filter_block = paid_filter_block + '''\n          <div className="field compact-field">\n            <label htmlFor="expense-class-filter">Expense type</label>\n            <select id="expense-class-filter" value={expenseClassFilter} onChange={(event) => setExpenseClassFilter(event.target.value)}>\n              <option value="all">All expenses</option>\n              <option value="fixed">Fixed bills</option>\n              <option value="variable">Variable spending</option>\n            </select>\n          </div>'''
if paid_filter_block not in app:
    raise SystemExit('Transactions payment filter UI target missing')
app = app.replace(paid_filter_block, replacement_filter_block, 1)

APP.write_text(app)

mobile = MOBILE.read_text()
if 'grid-template-columns: repeat(5, minmax(0, 1fr));' not in mobile:
    raise SystemExit('Five-column mobile nav target missing')
mobile = mobile.replace('grid-template-columns: repeat(5, minmax(0, 1fr));', 'grid-template-columns: repeat(4, minmax(0, 1fr));', 1)
old_nav_css = '''.nav button:nth-child(3) { --nav-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 3h12v18l-3-2-3 2-3-2-3 2V3Z'/%3E%3Cpath d='M9 8h6M9 12h6'/%3E%3C/g%3E%3C/svg%3E"); }\n.nav button:nth-child(3)::after { content: "Bills"; }\n.nav button:nth-child(4) { --nav-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='6' width='18' height='14' rx='3'/%3E%3Cpath d='M3 10h18M16 14h3'/%3E%3C/g%3E%3C/svg%3E"); }\n.nav button:nth-child(4)::after { content: "Savings"; }\n.nav button:nth-child(5) { --nav-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19V9M10 19V5M16 19v-7M22 19H2'/%3E%3C/g%3E%3C/svg%3E"); }\n.nav button:nth-child(5)::after { content: "Year"; }'''
new_nav_css = '''.nav button:nth-child(3) { --nav-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='6' width='18' height='14' rx='3'/%3E%3Cpath d='M3 10h18M16 14h3'/%3E%3C/g%3E%3C/svg%3E"); }\n.nav button:nth-child(3)::after { content: "Savings"; }\n.nav button:nth-child(4) { --nav-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19V9M10 19V5M16 19v-7M22 19H2'/%3E%3C/g%3E%3C/svg%3E"); }\n.nav button:nth-child(4)::after { content: "Year"; }'''
if old_nav_css not in mobile:
    raise SystemExit('Mobile nav icon/label target missing')
mobile = mobile.replace(old_nav_css, new_nav_css, 1)
MOBILE.write_text(mobile)

audit = AUDIT.read_text()
anchor = "  assert.doesNotMatch(files.mobileNav, /font-size:\\s*[0-8](?:\\.\\d+)?px/, 'Mobile navigation labels must not regress below 9px.');\n"
addition = anchor + "  assert.match(files.mobileNav, /grid-template-columns:\\s*repeat\\(4,/, 'Primary mobile navigation must remain the simplified four-destination layout.');\n  assert.doesNotMatch(files.app, /view === 'Bills'/, 'Bills must not return as a duplicate top-level destination.');\n  assert.doesNotMatch(files.app, /function Bills\\(/, 'Fixed bills must use the canonical Transactions view rather than a duplicate component.');\n  assert.match(files.app, /expenseClassFilter/, 'Transactions must retain a fixed-bill/variable-spending filter after removing the duplicate Bills tab.');\n  assert.doesNotMatch(files.app, /id=\"expense-breakdown-title\"/, 'Overview must not duplicate the detailed expense list from Transactions.');\n  assert.doesNotMatch(files.app, /id=\"income-breakdown-title\"/, 'Overview must not duplicate the detailed income list from Transactions.');\n"
if anchor not in audit:
    raise SystemExit('Source audit accessibility anchor missing')
audit = audit.replace(anchor, addition, 1)
AUDIT.write_text(audit)

changelog = CHANGELOG.read_text()
entry = '''## 2026-08-30 — Simplified navigation and removed duplicate views\n\n- Removed the duplicate Bills top-level tab; fixed bills now live only in Transactions → Expenses.\n- Added an Expense type filter in Transactions for All expenses, Fixed bills and Variable spending.\n- Removed the repeated detailed Income and Expense breakdown lists from Overview.\n- Kept Overview focused on summary figures, month setup, transfer planning and reconciliation.\n- Reduced the mobile navigation to four clear destinations: Overview, Transactions, Savings and Year.\n\n'''
CHANGELOG.write_text(entry + changelog)

VERSION.write_text('{\n  "version": "2026-08-30-deduplicated-ui-v1"\n}\n')
manifest = MANIFEST.read_text()
old_version = '/penny-budget/?v=2026-08-30-owner-income-v10'
new_version = '/penny-budget/?v=2026-08-30-deduplicated-ui-v1'
if old_version not in manifest:
    raise SystemExit('Manifest prior version target missing')
MANIFEST.write_text(manifest.replace(old_version, new_version, 1))

print('Applied Penny deduplicated UI patch')
