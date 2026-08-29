from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    'src/App.jsx',
    'Penny will not treat a missing value as £0.00.',
    'Penny will not treat a missing value as zero.',
    'embedded currency explanation',
)

replace_once(
    'src/App.jsx',
    "if ((kind === 'expense' || kind === 'income') && account === 'unassigned') issues.add('account');",
    "if ((kind === 'expense' || kind === 'income' || kind === 'movement') && account === 'unassigned') issues.add('account');",
    'movement account confirmation UI',
)

replace_once(
    'src/finance.js',
    """  const paidBy = cleanText(transaction.paidBy, type === 'expense' ? 'unassigned' : '', 120);
  const account = cleanText(transaction.account, type === 'expense' ? 'unassigned' : '', 120);
""",
    """  const paidBy = cleanText(transaction.paidBy, type === 'expense' ? 'unassigned' : '', 120);
  const accountRequired = type === 'expense' || ['internal_transfer','savings_transfer','card_repayment'].includes(type);
  const account = cleanText(transaction.account, accountRequired ? 'unassigned' : '', 120);
""",
    'movement account requirement',
)

replace_once(
    'src/finance.js',
    """  if (type === 'expense' && account === 'unassigned') issueSet.add('account');
  else if (type === 'expense') issueSet.delete('account');
""",
    """  if (accountRequired && account === 'unassigned') issueSet.add('account');
  else if (accountRequired) issueSet.delete('account');
""",
    'movement account issue normalisation',
)

replace_once(
    'src/finance.js',
    """function isIncompleteIncome(record) {
  return Boolean(record.needsConfirmation || record.confirmationIssues?.length);
}

export function monthSummary(state, monthKey) {
""",
    """function isIncompleteIncome(record) {
  return Boolean(record.needsConfirmation || record.confirmationIssues?.length);
}

function isIncompleteMovement(transaction) {
  return ['internal_transfer','savings_transfer','card_repayment'].includes(transaction.type)
    && Boolean(transaction.needsConfirmation || transaction.confirmationIssues?.length);
}

export function monthSummary(state, monthKey) {
""",
    'movement incomplete helper',
)

replace_once(
    'src/finance.js',
    """  const incompleteExpenses = expenseTransactions.filter(isIncompleteExpense).length;
  const incompleteIncome = incomeRecords.filter(isIncompleteIncome).length;
  const incompleteRecords = incompleteExpenses + incompleteIncome;
""",
    """  const incompleteExpenses = expenseTransactions.filter(isIncompleteExpense).length;
  const incompleteIncome = incomeRecords.filter(isIncompleteIncome).length;
  const incompleteMovements = transactions.filter(isIncompleteMovement).length;
  const incompleteRecords = incompleteExpenses + incompleteIncome + incompleteMovements;
""",
    'movement incomplete totals',
)

replace_once(
    'src/finance.js',
    """    incompleteExpenses,
    incompleteIncome,
    incompleteRecords,
""",
    """    incompleteExpenses,
    incompleteIncome,
    incompleteMovements,
    incompleteRecords,
""",
    'movement incomplete summary return',
)

replace_once(
    'scripts/final-audit-test.mjs',
    """  migrateState,
  monthSummary,
""",
    """  migrateState,
  monthSummary,
  normaliseTransaction,
""",
    'movement test import',
)

replace_once(
    'scripts/final-audit-test.mjs',
    """assert.equal(monthSummary(rawLegacyComplete, '2026-03').startingSavingsConfirmed, true, 'Existing valid pre-flag state must remain compatible.');

const subPennySavings = appReducer(createBlankState(), {
""",
    """assert.equal(monthSummary(rawLegacyComplete, '2026-03').startingSavingsConfirmed, true, 'Existing valid pre-flag state must remain compatible.');

const unassignedMovement = normaliseTransaction({
  id: 'movement-tbc',
  type: 'card_repayment',
  date: '2026-04-01',
  amount: 25,
  desc: 'Card repayment',
  account: 'unassigned',
  confirmationIssues: [],
});
assert.equal(unassignedMovement.confirmationIssues.includes('account'), true, 'Excluded movements must retain unresolved account evidence.');
const movementEvidenceState = migrateState({
  ...createBlankState(),
  monthMetaByMonth: { '2026-04': { status: 'complete', startingSavings: 100 } },
  savingsByMonth: { '2026-04': [{ id: 's1', label: 'Savings', balance: 100 }] },
  txnsByMonth: { '2026-04': [unassignedMovement] },
}, new Date(2026, 3, 30));
const movementEvidenceSummary = monthSummary(movementEvidenceState, '2026-04');
assert.equal(movementEvidenceSummary.incompleteMovements, 1, 'An unresolved transfer/card-repayment account must be counted as incomplete evidence.');
assert.equal(movementEvidenceSummary.auditReady, false, 'A completed month with an unresolved excluded movement must not be Ready.');

const subPennySavings = appReducer(createBlankState(), {
""",
    'movement evidence regression case',
)

replace_once(
    'scripts/source-audit.mjs',
    """  assert.match(files.finance, /confirmationIssues/);
  assert.match(files.finance, /dateConfirmed/);
""",
    """  assert.match(files.finance, /confirmationIssues/);
  assert.match(files.finance, /dateConfirmed/);
  assert.match(files.finance, /accountRequired = type === 'expense' \\|\\| \\['internal_transfer','savings_transfer','card_repayment'\\]\\.includes\\(type\\)/, 'Excluded movements must require account evidence.');
  assert.match(files.finance, /incompleteMovements/, 'Unresolved transfer and card-repayment evidence must prevent Ready status.');
  assert.match(files.app, /kind === 'movement'.*account === 'unassigned'/, 'Movement entry UI must preserve unassigned-account confirmation issues.');
""",
    'movement evidence source gates',
)

audit = Path('AUDIT.md')
text = audit.read_text()
needle = '- Unknown payer, receiver or account assignments remain explicitly unresolved until confirmed.\n'
addition = '- Internal transfers, savings transfers and card repayments require an assigned account; unresolved movement evidence prevents a completed month from being **Ready** even though the movement is excluded from spending.\n'
if needle not in text:
    raise SystemExit('AUDIT evidence marker not found')
if addition not in text:
    text = text.replace(needle, needle + addition, 1)
audit.write_text(text)

changelog = Path('CHANGELOG.md')
text = changelog.read_text()
needle = '- Added structured confirmation issues so unknown dates, payer/receiver and account evidence remain unresolved until explicitly confirmed.\n'
addition = '- Tightened excluded-movement evidence: internal transfers, savings transfers and card repayments now require an assigned account and can block `Ready` status when unresolved.\n'
if needle not in text:
    raise SystemExit('CHANGELOG evidence marker not found')
if addition not in text:
    text = text.replace(needle, needle + addition, 1)
changelog.write_text(text)

print('Final integrity patch applied')
