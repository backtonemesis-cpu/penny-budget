from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

replace_once(
    'src/App.jsx',
    """            <button className="primary-button" disabled={!canEditMonth || monthSetup.candidates.length === 0} onClick={onStartNewMonth}>
              {monthSetup.candidates.length ? 'Start New Month' : 'No Previous Bills'}
            </button>
""",
    """            <button className="primary-button" disabled={!canEditMonth || monthSetup.availableCount === 0} onClick={onStartNewMonth}>
              {monthSetup.availableCount > 0 ? 'Start New Month' : monthSetup.candidates.length ? 'Bills Already Copied' : 'No Previous Bills'}
            </button>
""",
)

replace_once(
    'src/App.jsx',
    """  if (record.source === 'import') badges.push(<span key="source" className="status-pill neutral">Imported</span>);
""",
    """  if (record.source === 'import') badges.push(<span key="source" className="status-pill neutral">Imported</span>);
  if (record.source === 'month_copy') badges.push(<span key="month-copy" className="status-pill neutral">Copied from prior month</span>);
""",
)

replace_once(
    'src/App.jsx',
    """    const effectiveDate = dateConfirmed ? date : `${monthKey}-01`;
""",
    """    const existingMonthDate = existing?.date?.slice(0, 7) === monthKey ? existing.date : '';
    const effectiveDate = dateConfirmed ? date : (existingMonthDate || `${monthKey}-01`);
""",
)

# Add regression coverage that duplicate recurring templates inside the source month are offered only once.
p = Path('scripts/month-setup-test.mjs')
text = p.read_text()
marker = """assert.equal(recurringBillKey(setup.candidates.find((candidate) => candidate.id === 'rent-aug').transaction), recurringBillKey(state.txnsByMonth['2026-09'][0]));

"""
addition = marker + """const sourceDuplicateState = {
  ...state,
  txnsByMonth: {
    ...state.txnsByMonth,
    '2026-08': [
      ...state.txnsByMonth['2026-08'],
      normaliseTransaction({ id: 'tax-aug-duplicate', type: 'expense', date: '2026-08-06', amount: 155, desc: 'Council tax', category: 'council_tax', expenseClass: 'fixed', paid: true, paidBy: 'p2', account: 'a2', confirmationIssues: [] }),
    ],
    '2026-09': [state.txnsByMonth['2026-09'][0]],
  },
};
const sourceDuplicateSetup = recurringBillSetup(sourceDuplicateState, '2026-09');
assert.equal(sourceDuplicateSetup.candidates.filter((candidate) => candidate.transaction.desc === 'Council tax' && !candidate.duplicate).length, 1, 'Equivalent recurring bills duplicated within the source month must only be offered once.');

"""
if text.count(marker) != 1:
    raise SystemExit('month-setup-test marker not found exactly once')
p.write_text(text.replace(marker, addition, 1))

# Source audit: copied records must remain visibly identifiable.
p = Path('scripts/month-setup-source-audit.mjs')
text = p.read_text()
marker = "assert.match(app, /StartNewMonthModal/, 'Recurring bills must be previewed before copying.');\n"
addition = marker + "assert.match(app, /Copied from prior month/, 'Copied recurring bills must remain visibly identifiable after setup.');\n"
if text.count(marker) != 1:
    raise SystemExit('month-setup-source-audit marker not found exactly once')
p.write_text(text.replace(marker, addition, 1))

print('Unified month setup refinements applied')
