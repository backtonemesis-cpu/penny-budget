from pathlib import Path

# Reassign selected-month income alongside expenses during an explicitly approved split.
state_path = Path('src/state.js')
state = state_path.read_text()
old = """      const rows = state.txnsByMonth[action.monthKey] || [];
      let changed = 0;
      const nextRows = rows.map((transaction) => {
        if (transaction.type !== 'expense' || transaction.account !== action.sourceAccountId) return transaction;
        const account = mappingByPayer.get(transaction.paidBy);
        if (!account) return transaction;
        changed += 1;
        return { ...transaction, account: account.id, accountLabel: account.label, accountOwnerId: account.ownerId, accountOwnerLabel: action.peopleLabels?.[account.ownerId] || transaction.paidByLabel || '' };
      });
      if (!changed) return state;
      const accounts = [...state.accounts];"""
new = """      const rows = state.txnsByMonth[action.monthKey] || [];
      let changedExpenses = 0;
      const nextRows = rows.map((transaction) => {
        if (transaction.type !== 'expense' || transaction.account !== action.sourceAccountId) return transaction;
        const account = mappingByPayer.get(transaction.paidBy);
        if (!account) return transaction;
        changedExpenses += 1;
        return { ...transaction, account: account.id, accountLabel: account.label, accountOwnerId: account.ownerId, accountOwnerLabel: action.peopleLabels?.[account.ownerId] || transaction.paidByLabel || '' };
      });
      const incomeRows = state.incomeByMonth[action.monthKey] || [];
      let changedIncome = 0;
      const nextIncomeRows = incomeRows.map((record) => {
        if (record.account !== action.sourceAccountId) return record;
        const account = mappingByPayer.get(record.receivedBy);
        if (!account) return record;
        changedIncome += 1;
        return { ...record, account: account.id, accountLabel: account.label, accountOwnerId: account.ownerId, accountOwnerLabel: action.peopleLabels?.[account.ownerId] || record.receivedByLabel || '' };
      });
      if (!changedExpenses && !changedIncome) return state;
      const accounts = [...state.accounts];"""
if old not in state:
    raise SystemExit('state split body anchor not found')
state = state.replace(old, new, 1)
old2 = """      const next = { ...state, accounts, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: sortByDate(nextRows) }, bankBalancesByMonth };
      return appendAudit(next, action, {
        action: 'split_account',
        entityType: 'account_resolution',
        monthKey: action.monthKey,
        label: `Separated ${action.sourceAccountLabel || 'account'} by owner`,
        before: { sourceAccountId: action.sourceAccountId },
        after: { mappings: action.mappings, reassignedTransactions: changed, clearedCurrentMonthBalance: true },
      });"""
new2 = """      const next = {
        ...state,
        accounts,
        txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: sortByDate(nextRows) },
        incomeByMonth: changedIncome ? { ...state.incomeByMonth, [action.monthKey]: sortByDate(nextIncomeRows) } : state.incomeByMonth,
        bankBalancesByMonth,
      };
      return appendAudit(next, action, {
        action: 'split_account',
        entityType: 'account_resolution',
        monthKey: action.monthKey,
        label: `Separated ${action.sourceAccountLabel || 'account'} by owner`,
        before: { sourceAccountId: action.sourceAccountId },
        after: { mappings: action.mappings, reassignedExpenses: changedExpenses, reassignedIncome: changedIncome, clearedCurrentMonthBalance: true },
      });"""
if old2 not in state:
    raise SystemExit('state split return anchor not found')
state_path.write_text(state.replace(old2, new2, 1))

# Make the confirmation accurately describe both proposal signals and keep TBC amounts honest in dialogs.
app_path = Path('src/App.jsx')
app = app_path.read_text()
old3 = """    if (!globalThis.confirm(`Separate ${plan.sourceAccount.label} into ${proposal}?\\n\\nThis proposal uses the existing Paid By assignments for this month only. If any bill is actually paid from the other person’s account, cancel and correct that bill first. Current bank balance for the old combined row will be cleared back to TBC.`)) return;"""
new3 = """    if (!globalThis.confirm(`Separate ${plan.sourceAccount.label} into ${proposal}?\\n\\nFor this month only, Penny proposes the split using Paid By on expenses and Received By on income. If any record actually belongs to the other person’s account, cancel and correct that record first. Historical months are not changed. The old combined current bank balance will be cleared back to TBC.`)) return;"""
if old3 not in app:
    raise SystemExit('split confirmation anchor not found')
app = app.replace(old3, new3, 1)
old4 = """    if (duplicate && !globalThis.confirm(`Possible duplicate: “${income.description}” for ${formatMoney(income.amount)} already exists on that date. Save this second record anyway?`)) {"""
new4 = """    const incomeAmountLabel = income.amountConfirmed === false ? 'amount TBC' : formatMoney(income.amount);
    if (duplicate && !globalThis.confirm(`Possible duplicate: “${income.description}” for ${incomeAmountLabel} already exists on that date. Save this second record anyway?`)) {"""
if old4 not in app:
    raise SystemExit('income duplicate anchor not found')
app = app.replace(old4, new4, 1)
old5 = """    if (!globalThis.confirm(`Delete “${record.description}” for ${formatMoney(record.amount)}? The deleted record will remain in Change History.`)) return;"""
new5 = """    const amountLabel = record.amountConfirmed === false ? 'amount TBC' : formatMoney(record.amount);
    if (!globalThis.confirm(`Delete “${record.description}” for ${amountLabel}? The deleted record will remain in Change History.`)) return;"""
if old5 not in app:
    raise SystemExit('income delete anchor not found')
app_path.write_text(app.replace(old5, new5, 1))

# Extend the regression test: selected-month income follows explicit Received By mapping; history does not.
test_path = Path('scripts/owner-income-v10-test.mjs')
test = test_path.read_text()
old6 = """  incomeByMonth: {
    '2026-09': ["""
new6 = """  incomeByMonth: {
    '2026-09': ["""
# Already same; add October income after September array block via a precise anchor.
anchor = """      normaliseIncomeRecord({ id:'reward', date:'2026-09-15', amount:50, description:'One off reward', incomeType:'Reward', receivedBy:'p1', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
    ],
  },
  bankBalancesByMonth:"""
replacement = """      normaliseIncomeRecord({ id:'reward', date:'2026-09-15', amount:50, description:'One off reward', incomeType:'Reward', receivedBy:'p1', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
    ],
    '2026-10': [
      normaliseIncomeRecord({ id:'oct-income-p1', date:'2026-10-01', amount:100, description:'Expected source 1', incomeType:'Other income', receivedBy:'p1', account:'legacy-bank', confirmationIssues:[] }, '2026-10'),
      normaliseIncomeRecord({ id:'oct-income-p2', date:'2026-10-02', amount:200, description:'Expected source 2', incomeType:'Other income', receivedBy:'p2', account:'legacy-bank', confirmationIssues:[] }, '2026-10'),
    ],
  },
  bankBalancesByMonth:"""
if anchor not in test:
    raise SystemExit('test income fixture anchor not found')
test = test.replace(anchor, replacement, 1)
anchor2 = """assert.equal(new Set(split.txnsByMonth['2026-10'].map((row) => row.account)).size, 2, 'Current month must use two distinct account IDs.');
assert.equal(split.bankBalancesByMonth['2026-10'], undefined, 'Combined current-month balance must be cleared after split.');"""
replacement2 = """assert.equal(new Set(split.txnsByMonth['2026-10'].map((row) => row.account)).size, 2, 'Current month must use two distinct account IDs.');
assert.equal(new Set(split.incomeByMonth['2026-10'].map((row) => row.account)).size, 2, 'Current-month income must follow the explicitly approved Received By owner mapping.');
assert.equal(base.incomeByMonth['2026-09'].every((row) => row.account === 'legacy-bank'), true, 'Historical income must not be rewritten by a current-month account split.');
assert.equal(split.bankBalancesByMonth['2026-10'], undefined, 'Combined current-month balance must be cleared after split.');"""
if anchor2 not in test:
    raise SystemExit('test split assertion anchor not found')
test_path.write_text(test.replace(anchor2, replacement2, 1))

# Source audit must keep the income side of explicit split covered.
audit_path = Path('scripts/source-audit.mjs')
audit = audit_path.read_text()
anchor3 = "  assert.match(files.state, /SPLIT_ACCOUNT_FOR_MONTH/);\n"
replacement3 = anchor3 + "  assert.match(files.state, /record\\.receivedBy/, 'Explicit account separation must also map selected-month income by Received By so future recurring income keeps the correct account ID.');\n"
if anchor3 not in audit:
    raise SystemExit('source audit split anchor not found')
audit_path.write_text(audit.replace(anchor3, replacement3, 1))

print('Finalized v10 account split consistency and TBC income messaging')
