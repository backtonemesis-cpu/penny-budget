from pathlib import Path
import json
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# Account resolution helper: explicit, reviewable split of ambiguous legacy
# accounts. It only rewrites the selected month and never rewrites history.
# -----------------------------------------------------------------------------
write('src/account-resolution.js', r'''import { createId } from './finance.js';

export function buildMonthAccountSplitPlan(state, monthKey, accountId, idFactory = createId) {
  const account = (state?.accounts || []).find((item) => item.id === accountId);
  if (!account || (account.ownerId && account.ownerId !== 'unassigned')) return null;
  const rows = (state?.txnsByMonth?.[monthKey] || []).filter((transaction) => (
    transaction.type === 'expense'
    && transaction.account === accountId
    && transaction.paidBy
    && !['unassigned', 'household'].includes(transaction.paidBy)
  ));
  const payerIds = [...new Set(rows.map((row) => row.paidBy))];
  if (payerIds.length < 2) return null;
  const people = Object.fromEntries((state?.people || []).map((person) => [person.id, person]));
  const mappings = payerIds.map((payerId) => ({
    paidBy: payerId,
    paidByLabel: people[payerId]?.label || rows.find((row) => row.paidBy === payerId)?.paidByLabel || payerId,
    account: {
      id: idFactory('account'),
      label: account.label,
      ownerId: payerId,
    },
  }));
  return { monthKey, sourceAccount: account, mappings };
}

export function splitPlanDescription(plan) {
  if (!plan) return '';
  return plan.mappings.map((mapping) => `${mapping.paidByLabel} · ${plan.sourceAccount.label}`).join(', ');
}
''')

# -----------------------------------------------------------------------------
# Month setup: recurring bills + regular income templates.
# -----------------------------------------------------------------------------
write('src/month-setup.js', r'''import {
  createId,
  isValidDateKey,
  isValidMonthKey,
  normaliseIncomeRecord,
  normaliseTransaction,
  previousMonthKey,
  roundMoney,
} from './finance.js';

function compareText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function recurringBillKey(transaction) {
  if (!transaction || transaction.type !== 'expense' || transaction.expenseClass !== 'fixed') return '';
  return [
    compareText(transaction.desc),
    compareText(transaction.category),
    compareText(transaction.paidBy),
    compareText(transaction.account),
  ].join('::');
}

export function recurringIncomeKey(record) {
  if (!record) return '';
  return [
    compareText(record.description),
    compareText(record.incomeType),
    compareText(record.receivedBy),
    compareText(record.account),
  ].join('::');
}

export function recurringIncomeMode(record) {
  if (record?.recurrenceMode === 'fixed' || record?.recurrenceMode === 'confirm') return record.recurrenceMode;
  const text = `${record?.incomeType || ''} ${record?.description || ''}`.toLowerCase();
  if (/child\s*(benefit|maintenance)|c\s*benefit|c\s*maintenance/.test(text)) return 'fixed';
  if (/employment|paycheck|salary|wages?|universal\s*credit|u\s*credit|benefits?/.test(text)) return 'confirm';
  return 'manual';
}

export function recurringTargetDate(sourceDate, targetMonthKey) {
  if (!isValidMonthKey(targetMonthKey)) return '';
  const [year, month] = targetMonthKey.split('-').map(Number);
  const sourceDay = isValidDateKey(sourceDate) ? Number(sourceDate.slice(8, 10)) : 1;
  const lastDay = new Date(year, month, 0).getDate();
  return `${targetMonthKey}-${String(Math.min(Math.max(sourceDay, 1), lastDay)).padStart(2, '0')}`;
}

export const recurringBillTargetDate = recurringTargetDate;

function dedupeCandidates(sourceRows, targetRows, keyFn) {
  const protectedKeys = new Set(targetRows.map(keyFn).filter(Boolean));
  return sourceRows.map((row) => {
    const key = keyFn(row);
    const duplicate = !key || protectedKeys.has(key);
    if (key) protectedKeys.add(key);
    return { id: row.id, duplicate, row };
  });
}

export function recurringBillSetup(state, targetMonthKey) {
  const sourceMonthKey = previousMonthKey(targetMonthKey);
  if (!sourceMonthKey) return {
    sourceMonthKey: '', targetMonthKey, candidates: [], incomeCandidates: [],
    availableCount: 0, availableIncomeCount: 0, duplicateCount: 0, duplicateIncomeCount: 0, totalAvailableCount: 0,
  };

  const sourceBills = (state?.txnsByMonth?.[sourceMonthKey] || [])
    .filter((transaction) => transaction.type === 'expense' && transaction.expenseClass === 'fixed')
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  const targetBills = (state?.txnsByMonth?.[targetMonthKey] || [])
    .filter((transaction) => transaction.type === 'expense' && transaction.expenseClass === 'fixed');
  const candidates = dedupeCandidates(sourceBills, targetBills, recurringBillKey)
    .map(({ id, duplicate, row }) => ({ id, duplicate, transaction: row }));

  const sourceIncome = (state?.incomeByMonth?.[sourceMonthKey] || [])
    .filter((record) => recurringIncomeMode(record) !== 'manual')
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  const targetIncome = state?.incomeByMonth?.[targetMonthKey] || [];
  const incomeCandidates = dedupeCandidates(sourceIncome, targetIncome, recurringIncomeKey)
    .map(({ id, duplicate, row }) => ({ id, duplicate, record: row, mode: recurringIncomeMode(row) }));

  const availableCount = candidates.filter((candidate) => !candidate.duplicate).length;
  const availableIncomeCount = incomeCandidates.filter((candidate) => !candidate.duplicate).length;
  return {
    sourceMonthKey,
    targetMonthKey,
    candidates,
    incomeCandidates,
    availableCount,
    availableIncomeCount,
    duplicateCount: candidates.filter((candidate) => candidate.duplicate).length,
    duplicateIncomeCount: incomeCandidates.filter((candidate) => candidate.duplicate).length,
    totalAvailableCount: availableCount + availableIncomeCount,
  };
}

function ownerLabel(ownerId, people) {
  if (ownerId === 'household') return 'Joint';
  if (!ownerId || ownerId === 'unassigned') return '';
  return people[ownerId]?.label || '';
}

export function buildRecurringBillCopies(state, targetMonthKey, selectedIds, idFactory = createId) {
  const setup = recurringBillSetup(state, targetMonthKey);
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const people = Object.fromEntries((state?.people || []).map((person) => [person.id, person]));
  const accounts = Object.fromEntries((state?.accounts || []).map((account) => [account.id, account]));
  return setup.candidates.flatMap(({ id, transaction, duplicate }) => {
    if (duplicate || !selected.has(id)) return [];
    const account = accounts[transaction.account];
    const ownerId = account?.ownerId || transaction.accountOwnerId || 'unassigned';
    const copied = normaliseTransaction({
      ...transaction,
      id: idFactory('txn'),
      date: recurringTargetDate(transaction.date, targetMonthKey),
      paid: false,
      paidByLabel: transaction.paidBy === 'household' ? 'Joint' : people[transaction.paidBy]?.label || transaction.paidByLabel || '',
      accountLabel: account?.label || transaction.accountLabel || transaction.account || '',
      accountOwnerId: ownerId,
      accountOwnerLabel: ownerLabel(ownerId, people),
      confirmationIssues: ['date', ...(transaction.confirmationIssues || []).filter((issue) => issue === 'other')],
      dateConfirmed: false,
      needsConfirmation: true,
      source: 'month_copy',
    }, state?.customCats || []);
    return copied ? [copied] : [];
  });
}

export function buildRecurringIncomeCopies(state, targetMonthKey, selectedIds, idFactory = createId) {
  const setup = recurringBillSetup(state, targetMonthKey);
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const people = Object.fromEntries((state?.people || []).map((person) => [person.id, person]));
  const accounts = Object.fromEntries((state?.accounts || []).map((account) => [account.id, account]));
  return setup.incomeCandidates.flatMap(({ id, record, mode, duplicate }) => {
    if (duplicate || !selected.has(id)) return [];
    const account = accounts[record.account];
    const ownerId = account?.ownerId || record.accountOwnerId || 'unassigned';
    const amountConfirmed = mode === 'fixed';
    const confirmationIssues = ['date', 'received', ...(amountConfirmed ? [] : ['amount'])];
    if (record.receivedBy === 'unassigned') confirmationIssues.push('receivedBy');
    if (record.account === 'unassigned') confirmationIssues.push('account');
    const copied = normaliseIncomeRecord({
      ...record,
      id: idFactory('income'),
      date: recurringTargetDate(record.date, targetMonthKey),
      amount: amountConfirmed ? record.amount : 0,
      amountConfirmed,
      incomeStatus: 'expected',
      recurrenceMode: mode,
      receivedByLabel: people[record.receivedBy]?.label || record.receivedByLabel || '',
      accountLabel: account?.label || record.accountLabel || record.account || '',
      accountOwnerId: ownerId,
      accountOwnerLabel: ownerLabel(ownerId, people),
      confirmationIssues,
      dateConfirmed: false,
      needsConfirmation: true,
      source: 'month_copy',
    }, targetMonthKey);
    return copied ? [copied] : [];
  });
}

export function buildMonthSetupCopies(state, targetMonthKey, selection = {}, idFactory = createId) {
  return {
    bills: buildRecurringBillCopies(state, targetMonthKey, selection.billIds || [], idFactory),
    income: buildRecurringIncomeCopies(state, targetMonthKey, selection.incomeIds || [], idFactory),
  };
}

export function recurringBillSelectionTotal(setup, selectedIds) {
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  return roundMoney((setup?.candidates || []).reduce((sum, candidate) => (
    !candidate.duplicate && selected.has(candidate.id) ? sum + Number(candidate.transaction.amount || 0) : sum
  ), 0));
}

export function recurringIncomeSelectionTotal(setup, selectedIds) {
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  return roundMoney((setup?.incomeCandidates || []).reduce((sum, candidate) => (
    !candidate.duplicate && candidate.mode === 'fixed' && selected.has(candidate.id) ? sum + Number(candidate.record.amount || 0) : sum
  ), 0));
}
''')

# -----------------------------------------------------------------------------
# Finance schema v10, expected income, ambiguous funding protection.
# -----------------------------------------------------------------------------
finance = read('src/finance.js')
finance = replace_once(finance,
    "export const CONFIRMATION_ISSUES = new Set(['date','paidBy','account','receivedBy','other']);\nexport const CURRENT_STATE_VERSION = 9;",
    "export const CONFIRMATION_ISSUES = new Set(['date','paidBy','account','receivedBy','amount','received','other']);\nexport const CURRENT_STATE_VERSION = 10;",
    'finance version')

old_income = re.search(r"export function normaliseIncomeRecord\(record, monthKey\) \{.*?\n\}\n\nfunction normaliseTransactionsByMonth", finance, re.S)
if not old_income:
    raise SystemExit('normaliseIncomeRecord block not found')
new_income = r'''export function normaliseIncomeRecord(record, monthKey) {
  if (!record || typeof record !== 'object' || !isValidMonthKey(monthKey)) return null;
  const parsedAmount = Number.parseFloat(record.amount);
  const incomeStatus = record.incomeStatus === 'expected' ? 'expected' : 'received';
  const amountConfirmed = record.amountConfirmed === false
    ? false
    : Number.isFinite(parsedAmount) && parsedAmount > 0;
  if (!amountConfirmed && incomeStatus !== 'expected') return null;
  const amount = amountConfirmed ? positiveNumber(parsedAmount) : 0;
  const dateProvided = isValidDateKey(record.date);
  const date = dateProvided ? record.date : `${monthKey}-01`;
  const description = cleanText(record.description ?? record.label, '', 120);
  if (!description) return null;
  const receivedBy = cleanText(record.receivedBy, 'unassigned', 120);
  const account = cleanText(record.account, 'unassigned', 120);
  const incomeType = cleanText(record.incomeType ?? record.type ?? record.label, 'Other income', 80);
  const recurrenceMode = ['fixed','confirm'].includes(record.recurrenceMode) ? record.recurrenceMode : 'manual';
  const explicitIssues = Array.isArray(record.confirmationIssues);
  const issueSet = new Set(normaliseConfirmationIssues(record.confirmationIssues));
  if (!dateProvided || record.dateConfirmed === false || (!explicitIssues && record.needsConfirmation)) issueSet.add('date');
  if (receivedBy === 'unassigned') issueSet.add('receivedBy');
  else issueSet.delete('receivedBy');
  if (account === 'unassigned') issueSet.add('account');
  else issueSet.delete('account');
  if (!amountConfirmed) issueSet.add('amount');
  else issueSet.delete('amount');
  if (incomeStatus === 'expected') issueSet.add('received');
  else issueSet.delete('received');
  const confirmationIssues = [...issueSet];
  return {
    id: cleanText(record.id, createId('income'), 160),
    date,
    amount,
    amountConfirmed,
    incomeStatus,
    recurrenceMode,
    description,
    incomeType,
    receivedBy,
    account,
    receivedByLabel: cleanText(record.receivedByLabel, '', 80),
    accountLabel: cleanText(record.accountLabel, '', 80),
    accountOwnerId: cleanText(record.accountOwnerId, '', 120),
    accountOwnerLabel: cleanText(record.accountOwnerLabel, '', 80),
    confirmationIssues,
    dateConfirmed: !confirmationIssues.includes('date'),
    needsConfirmation: confirmationIssues.length > 0,
    source: cleanText(record.source, 'legacy', 32),
  };
}

function normaliseTransactionsByMonth'''
finance = finance[:old_income.start()] + new_income + finance[old_income.end():]

finance = replace_once(finance,
    "  const income = sumMoney(incomeRecords.map((record) => record.amount));",
    "  const income = sumMoney(incomeRecords.filter((record) => record.amountConfirmed !== false).map((record) => record.amount));\n  const receivedIncome = sumMoney(incomeRecords.filter((record) => record.incomeStatus !== 'expected' && record.amountConfirmed !== false).map((record) => record.amount));\n  const expectedIncome = sumMoney(incomeRecords.filter((record) => record.incomeStatus === 'expected' && record.amountConfirmed !== false).map((record) => record.amount));\n  const tbcIncomeCount = incomeRecords.filter((record) => record.amountConfirmed === false).length;",
    'income summary')

old_map = """  const accountFundingPlan = [...accountPlan.values()]
    .map((row) => ({
      ...row,
      transferNeeded: roundMoney(Math.max(0, row.amount - row.currentBalance)),
      balanceAfterPlannedPayments: roundMoney(row.currentBalance - row.amount),
      payers: row.payers.sort((a, b) => b.amount - a.amount || String(a.paidBy).localeCompare(String(b.paidBy))),
    }))
    .sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
  const hasUnconfirmedBankBalances = accountFundingPlan.some((row) => !row.hasCurrentBalance);
  const hasUnconfirmedAccountOwners = accountFundingPlan.some((row) => !row.ownerId || row.ownerId === 'unassigned');
  const totalTransferNeeded = sumMoney(accountFundingPlan.map((row) => row.transferNeeded));"""
new_map = """  const accountFundingPlan = [...accountPlan.values()]
    .map((row) => {
      const payers = row.payers.sort((a, b) => b.amount - a.amount || String(a.paidBy).localeCompare(String(b.paidBy)));
      const distinctPayers = [...new Set(payers.map((payer) => payer.paidBy).filter((paidBy) => paidBy && !['unassigned','household'].includes(paidBy)))];
      const ambiguousAccount = (!row.ownerId || row.ownerId === 'unassigned') && distinctPayers.length > 1;
      return {
        ...row,
        payers,
        ambiguousAccount,
        transferNeeded: ambiguousAccount ? null : roundMoney(Math.max(0, row.amount - row.currentBalance)),
        balanceAfterPlannedPayments: ambiguousAccount ? null : roundMoney(row.currentBalance - row.amount),
      };
    })
    .sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
  const hasAmbiguousFundingAccounts = accountFundingPlan.some((row) => row.ambiguousAccount);
  const hasUnconfirmedBankBalances = accountFundingPlan.some((row) => !row.hasCurrentBalance && !row.ambiguousAccount);
  const hasUnconfirmedAccountOwners = accountFundingPlan.some((row) => !row.ownerId || row.ownerId === 'unassigned');
  const totalTransferNeeded = hasAmbiguousFundingAccounts ? null : sumMoney(accountFundingPlan.map((row) => row.transferNeeded || 0));"""
finance = replace_once(finance, old_map, new_map, 'account funding map')

finance = replace_once(finance,
    "    income,\n    expenses,",
    "    income,\n    receivedIncome,\n    expectedIncome,\n    tbcIncomeCount,\n    expenses,",
    'summary return income fields')
finance = replace_once(finance,
    "    hasUnconfirmedBankBalances,\n    hasUnconfirmedAccountOwners,",
    "    hasUnconfirmedBankBalances,\n    hasAmbiguousFundingAccounts,\n    hasUnconfirmedAccountOwners,",
    'summary return ambiguity')
write('src/finance.js', finance)

# -----------------------------------------------------------------------------
# Reducer: atomic month setup + selected-month account split.
# -----------------------------------------------------------------------------
state = read('src/state.js')
state = replace_once(state,
    "import { recurringBillKey } from './month-setup.js';",
    "import { recurringBillKey, recurringIncomeKey } from './month-setup.js';",
    'state imports')

anchor = "    case 'COPY_RECURRING_BILLS': {"
idx = state.find(anchor)
if idx < 0:
    raise SystemExit('COPY_RECURRING_BILLS not found')
insert = r'''    case 'START_NEW_MONTH': {
      if (!isValidMonthKey(action.monthKey)) return state;
      const existingTxns = state.txnsByMonth[action.monthKey] || [];
      const billKeys = new Set(existingTxns.filter((row) => row.type === 'expense' && row.expenseClass === 'fixed').map(recurringBillKey).filter(Boolean));
      const copiedBills = [];
      (action.bills || []).forEach((bill) => {
        const key = recurringBillKey(bill);
        if (!key || billKeys.has(key)) return;
        billKeys.add(key);
        copiedBills.push({ ...bill, paid: false, source: 'month_copy' });
      });
      const existingIncome = state.incomeByMonth[action.monthKey] || [];
      const incomeKeys = new Set(existingIncome.map(recurringIncomeKey).filter(Boolean));
      const copiedIncome = [];
      (action.income || []).forEach((record) => {
        const key = recurringIncomeKey(record);
        if (!key || incomeKeys.has(key)) return;
        incomeKeys.add(key);
        copiedIncome.push({ ...record, source: 'month_copy', incomeStatus: 'expected' });
      });
      const sourceBudget = isValidMonthKey(action.sourceMonthKey) ? state.budgetsByMonth?.[action.sourceMonthKey] : null;
      const copyBudget = sourceBudget && !state.budgetsByMonth?.[action.monthKey];
      if (!copiedBills.length && !copiedIncome.length && !copyBudget) return state;
      const next = {
        ...state,
        txnsByMonth: copiedBills.length ? { ...state.txnsByMonth, [action.monthKey]: sortByDate([...copiedBills, ...existingTxns]) } : state.txnsByMonth,
        incomeByMonth: copiedIncome.length ? { ...state.incomeByMonth, [action.monthKey]: sortByDate([...copiedIncome, ...existingIncome]) } : state.incomeByMonth,
        budgetsByMonth: copyBudget ? { ...state.budgetsByMonth, [action.monthKey]: { ...sourceBudget } } : state.budgetsByMonth,
      };
      return appendAudit(next, action, {
        action: 'start_month',
        entityType: 'monthly_setup',
        monthKey: action.monthKey,
        label: `Started month with ${copiedBills.length} bill${copiedBills.length === 1 ? '' : 's'} and ${copiedIncome.length} income item${copiedIncome.length === 1 ? '' : 's'}`,
        after: { sourceMonthKey: action.sourceMonthKey || '', copiedBills, copiedIncome, copiedBudget: Boolean(copyBudget) },
      });
    }
    case 'SPLIT_ACCOUNT_FOR_MONTH': {
      if (!isValidMonthKey(action.monthKey) || !action.sourceAccountId || !Array.isArray(action.mappings) || action.mappings.length < 2) return state;
      const mappingByPayer = new Map(action.mappings.filter((mapping) => mapping?.paidBy && mapping?.account?.id).map((mapping) => [mapping.paidBy, mapping.account]));
      if (mappingByPayer.size < 2) return state;
      const rows = state.txnsByMonth[action.monthKey] || [];
      let changed = 0;
      const nextRows = rows.map((transaction) => {
        if (transaction.type !== 'expense' || transaction.account !== action.sourceAccountId) return transaction;
        const account = mappingByPayer.get(transaction.paidBy);
        if (!account) return transaction;
        changed += 1;
        return { ...transaction, account: account.id, accountLabel: account.label, accountOwnerId: account.ownerId, accountOwnerLabel: action.peopleLabels?.[account.ownerId] || transaction.paidByLabel || '' };
      });
      if (!changed) return state;
      const accounts = [...state.accounts];
      action.mappings.forEach((mapping) => {
        if (!accounts.some((account) => account.id === mapping.account.id)) accounts.push(mapping.account);
      });
      const bankRows = (state.bankBalancesByMonth?.[action.monthKey] || []).filter((row) => row.id !== action.sourceAccountId);
      const bankBalancesByMonth = { ...(state.bankBalancesByMonth || {}) };
      if (bankRows.length) bankBalancesByMonth[action.monthKey] = bankRows;
      else delete bankBalancesByMonth[action.monthKey];
      const next = { ...state, accounts, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: sortByDate(nextRows) }, bankBalancesByMonth };
      return appendAudit(next, action, {
        action: 'split_account',
        entityType: 'account_resolution',
        monthKey: action.monthKey,
        label: `Separated ${action.sourceAccountLabel || 'account'} by owner`,
        before: { sourceAccountId: action.sourceAccountId },
        after: { mappings: action.mappings, reassignedTransactions: changed, clearedCurrentMonthBalance: true },
      });
    }
'''
state = state[:idx] + insert + state[idx:]
write('src/state.js', state)

# -----------------------------------------------------------------------------
# App UI/flow.
# -----------------------------------------------------------------------------
app = read('src/App.jsx')
app = replace_once(app,
    "import { buildRecurringBillCopies, recurringBillSelectionTotal, recurringBillSetup } from './month-setup.js';",
    "import { buildMonthSetupCopies, recurringBillSelectionTotal, recurringBillSetup, recurringIncomeSelectionTotal } from './month-setup.js';\nimport { buildMonthAccountSplitPlan, splitPlanDescription } from './account-resolution.js';",
    'app month imports')
app = replace_once(app,
    "  account: 'Account',\n  other: 'Supporting evidence',",
    "  account: 'Account',\n  amount: 'Amount',\n  received: 'Receipt status',\n  other: 'Supporting evidence',",
    'confirmation labels')

old_start = re.search(r"  const startNewMonth = \(selectedIds\) => \{.*?\n  \};\n\n  const erasePennyData", app, re.S)
if not old_start:
    raise SystemExit('startNewMonth function not found')
new_start = r'''  const startNewMonth = (selection) => {
    if (!canEditMonth || summary.isComplete) {
      setMessage('Completed months cannot be started from a previous month.');
      return;
    }
    const copies = buildMonthSetupCopies(state, monthKey, selection);
    if (!copies.bills.length && !copies.income.length) {
      setModal(null);
      setToast('Nothing new was selected. Existing month records were left unchanged.');
      return;
    }
    mutate({
      type: 'START_NEW_MONTH',
      monthKey,
      sourceMonthKey: monthSetup.sourceMonthKey,
      bills: copies.bills,
      income: copies.income,
      auditLabel: `Set up ${MONTHS[period.month]} ${period.year} from recurring records`,
    });
    setModal(null);
    setToast(`${copies.bills.length} bill${copies.bills.length === 1 ? '' : 's'} and ${copies.income.length} regular income item${copies.income.length === 1 ? '' : 's'} carried into ${MONTHS[period.month]}.`);
  };

  const toggleIncomeReceived = (record) => {
    if (!canEditMonth) {
      setMessage('This month is locked. Unlock corrections before changing income status.');
      return;
    }
    if (record.incomeStatus === 'expected' && record.amountConfirmed === false) {
      setMessage('Confirm the income amount before marking it received.');
      return;
    }
    const issues = new Set(record.confirmationIssues || []);
    const nextStatus = record.incomeStatus === 'expected' ? 'received' : 'expected';
    if (nextStatus === 'received') issues.delete('received');
    else issues.add('received');
    const next = normaliseIncomeRecord({ ...record, incomeStatus: nextStatus, confirmationIssues: [...issues] }, record.date.slice(0, 7));
    if (!next) return;
    mutate({ type: 'UPDATE_INCOME', monthKey: record.date.slice(0, 7), record: next, auditLabel: `${nextStatus === 'received' ? 'Mark received' : 'Mark expected'}: ${record.description}` });
  };

  const separateFundingAccount = (accountId) => {
    const plan = buildMonthAccountSplitPlan(state, monthKey, accountId);
    if (!plan) {
      setMessage('This account does not currently need to be separated.');
      return;
    }
    const proposal = splitPlanDescription(plan);
    if (!globalThis.confirm(`Separate ${plan.sourceAccount.label} into ${proposal}?\n\nThis proposal uses the existing Paid By assignments for this month only. If any bill is actually paid from the other person’s account, cancel and correct that bill first. Current bank balance for the old combined row will be cleared back to TBC.`)) return;
    const peopleLabels = Object.fromEntries(state.people.map((person) => [person.id, person.label]));
    mutate({
      type: 'SPLIT_ACCOUNT_FOR_MONTH',
      monthKey,
      sourceAccountId: plan.sourceAccount.id,
      sourceAccountLabel: plan.sourceAccount.label,
      mappings: plan.mappings,
      peopleLabels,
      auditLabel: `Separate ${plan.sourceAccount.label} accounts for ${MONTHS[period.month]} ${period.year}`,
    });
    setToast(`${plan.sourceAccount.label} separated into owner-specific accounts. Enter fresh bank balances for each one.`);
  };

  const erasePennyData'''
app = app[:old_start.start()] + new_start + app[old_start.end():]

app = replace_once(app,
    "            onAddExpense={() => openRecord({ mode: 'expense' })}\n          />",
    "            onAddExpense={() => openRecord({ mode: 'expense' })}\n            onSeparateAccount={separateFundingAccount}\n          />",
    'overview prop')
app = replace_once(app,
    "            onEditIncome={(record) => openRecord({ mode: 'income', income: record })}\n            onDeleteTransaction={deleteTransaction}",
    "            onEditIncome={(record) => openRecord({ mode: 'income', income: record })}\n            onToggleIncomeReceived={toggleIncomeReceived}\n            onDeleteTransaction={deleteTransaction}",
    'transactions income toggle prop')

app = replace_once(app,
    "function Overview({ summary, month, year, categoryMap, peopleMap, accountMap, monthKey, monthSetup, canEditMonth, onUnlockMonth, onStartNewMonth, onUpdateBankBalance, onAddIncome, onAddExpense }) {",
    "function Overview({ summary, month, year, categoryMap, peopleMap, accountMap, monthKey, monthSetup, canEditMonth, onUnlockMonth, onStartNewMonth, onUpdateBankBalance, onAddIncome, onAddExpense, onSeparateAccount }) {",
    'overview signature')
app = replace_once(app,
    "      {!summary.isComplete && monthSetup.availableCount > 0 && (",
    "      {!summary.isComplete && monthSetup.totalAvailableCount > 0 && (",
    'overview setup condition')
app = replace_once(app,
    "              <p className=\"section-note\">{monthSetup.availableCount} recurring bill{monthSetup.availableCount === 1 ? '' : 's'} available from {sourceMonthLabel}. Review before copying.</p>\n            </div>\n            <button className=\"primary-button\" disabled={!canEditMonth} onClick={onStartNewMonth}>Copy Bills</button>",
    "              <p className=\"section-note\">{monthSetup.availableCount} bill{monthSetup.availableCount === 1 ? '' : 's'} and {monthSetup.availableIncomeCount} regular income item{monthSetup.availableIncomeCount === 1 ? '' : 's'} available from {sourceMonthLabel}.</p>\n            </div>\n            <button className=\"primary-button\" disabled={!canEditMonth} onClick={onStartNewMonth}>Set Up Month</button>",
    'overview setup text')
app = replace_once(app,
    "        <Stat variant=\"compact\" label=\"Income\" value={formatMoney(summary.income)} tone=\"green\" sub=\"This month\" onClick={canEditMonth ? onAddIncome : undefined} />",
    "        <Stat variant=\"compact\" label=\"Income\" value={formatMoney(summary.income)} tone=\"green\" sub={summary.tbcIncomeCount ? `${summary.tbcIncomeCount} amount${summary.tbcIncomeCount === 1 ? '' : 's'} TBC` : summary.expectedIncome > 0 ? 'Received + expected' : 'This month'} onClick={canEditMonth ? onAddIncome : undefined} />",
    'income stat')

old_transfer_head = """              <div className={`money strong ${summary.hasUnconfirmedBankBalances ? 'amber' : summary.totalTransferNeeded > 0 ? 'amber' : 'green'}`}>{summary.hasUnconfirmedBankBalances ? 'TBC' : formatMoney(summary.totalTransferNeeded)}</div>"""
new_transfer_head = """              <div className={`money strong ${(summary.hasUnconfirmedBankBalances || summary.hasAmbiguousFundingAccounts) ? 'amber' : summary.totalTransferNeeded > 0 ? 'amber' : 'green'}`}>{(summary.hasUnconfirmedBankBalances || summary.hasAmbiguousFundingAccounts) ? 'TBC' : formatMoney(summary.totalTransferNeeded)}</div>"""
app = replace_once(app, old_transfer_head, new_transfer_head, 'transfer head')

old_row_math = """                  <span>{row.hasCurrentBalance ? `Current bank balance: ${formatMoney(row.currentBalance)}` : 'Current bank balance: TBC'}</span>
                  <span className={row.transferNeeded > 0 ? 'amber' : 'green'}>Transfer needed: {row.hasCurrentBalance ? formatMoney(row.transferNeeded) : 'TBC'}</span>
                </div>
                <FundingBalanceEditor
                  row={row}
                  monthKey={monthKey}
                  canEdit={canEditMonth}
                  onCommit={(value) => onUpdateBankBalance(row.account, value)}
                />"""
new_row_math = """                  <span>{row.ambiguousAccount ? 'Current bank balance: TBC — separate accounts first' : row.hasCurrentBalance ? `Current bank balance: ${formatMoney(row.currentBalance)}` : 'Current bank balance: TBC'}</span>
                  <span className={!row.ambiguousAccount && row.transferNeeded > 0 ? 'amber' : 'green'}>Transfer needed: {row.ambiguousAccount ? 'TBC' : row.hasCurrentBalance ? formatMoney(row.transferNeeded) : 'TBC'}</span>
                </div>
                {row.ambiguousAccount ? (
                  <div className=\"account-resolution-inline\">
                    <strong>Separate bank accounts required</strong>
                    <span>This TBC account is being used by more than one payer. Do not enter one combined balance.</span>
                    <button className=\"secondary-button\" onClick={() => onSeparateAccount(row.account)}>Separate accounts</button>
                  </div>
                ) : (
                  <FundingBalanceEditor
                    row={row}
                    monthKey={monthKey}
                    canEdit={canEditMonth}
                    onCommit={(value) => onUpdateBankBalance(row.account, value)}
                  />
                )}"""
app = replace_once(app, old_row_math, new_row_math, 'funding row')
app = replace_once(app,
    "              <div className=\"money\">{row.hasCurrentBalance ? formatMoney(row.transferNeeded) : 'TBC'}</div>",
    "              <div className=\"money\">{row.ambiguousAccount ? 'TBC' : row.hasCurrentBalance ? formatMoney(row.transferNeeded) : 'TBC'}</div>",
    'funding side money')

app = replace_once(app,
    "function Transactions({ summary, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onDeleteTransaction, onDeleteIncome }) {",
    "function Transactions({ summary, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onToggleIncomeReceived, onDeleteTransaction, onDeleteIncome }) {",
    'transactions signature')

old_income_row = """                <div className=\"record-meta\">Received by {record.receivedByLabel || peopleMap[record.receivedBy]?.label || record.receivedBy} · {ownedRecordAccountLabel(record, accountMap, peopleMap)}</div>
                <RecordBadges record={record} />
              </div>
              <div className=\"record-side\">
                <div className=\"money green\">{formatMoney(record.amount)}</div>
                {canEdit && <div className=\"mini-actions\">
                  <button className=\"secondary-button\" onClick={() => onEditIncome(record)}>Edit</button>"""
new_income_row = """                <div className=\"record-meta\">Received by {record.receivedByLabel || peopleMap[record.receivedBy]?.label || record.receivedBy} · {ownedRecordAccountLabel(record, accountMap, peopleMap)}</div>
                <div className=\"pill-line\"><span className={`status-pill ${record.incomeStatus === 'expected' ? 'warning' : 'success'}`}>{record.incomeStatus === 'expected' ? 'Expected' : 'Received'}</span><RecordBadges record={record} compact /></div>
              </div>
              <div className=\"record-side\">
                <div className=\"money green\">{record.amountConfirmed === false ? 'TBC' : formatMoney(record.amount)}</div>
                {canEdit && <div className=\"mini-actions\">
                  <button className=\"secondary-button\" onClick={() => onToggleIncomeReceived(record)}>{record.incomeStatus === 'expected' ? 'Mark received' : 'Mark expected'}</button>
                  <button className=\"secondary-button\" onClick={() => onEditIncome(record)}>Edit</button>"""
app = replace_once(app, old_income_row, new_income_row, 'income row')

# Replace StartNewMonthModal entirely.
modal = re.search(r"function StartNewMonthModal\(\{ setup, targetMonthKey, peopleMap, accountMap, onConfirm, onClose \}\) \{.*?\n\}\n\nfunction Savings", app, re.S)
if not modal:
    raise SystemExit('StartNewMonthModal block not found')
new_modal = r'''function StartNewMonthModal({ setup, targetMonthKey, peopleMap, accountMap, onConfirm, onClose }) {
  const [selectedBills, setSelectedBills] = useState(() => new Set(setup.candidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id)));
  const [selectedIncome, setSelectedIncome] = useState(() => new Set(setup.incomeCandidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id)));
  const targetLabel = `${MONTHS[Number(targetMonthKey.slice(5, 7)) - 1]} ${targetMonthKey.slice(0, 4)}`;
  const sourceLabel = setup.sourceMonthKey ? `${MONTHS[Number(setup.sourceMonthKey.slice(5, 7)) - 1]} ${setup.sourceMonthKey.slice(0, 4)}` : 'the previous month';
  const toggle = (setter, id) => setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const billTotal = recurringBillSelectionTotal(setup, [...selectedBills]);
  const fixedIncomeTotal = recurringIncomeSelectionTotal(setup, [...selectedIncome]);
  const selectedCount = selectedBills.size + selectedIncome.size;

  return (
    <SimpleModal title={`Set up ${targetLabel}`} onClose={onClose} wide>
      <p className="section-note">Carry forward planning records from {sourceLabel}. Bills start Unpaid. Regular income starts Expected. Child Benefit and Child Maintenance keep the previous amount; pay and variable benefits carry forward with Amount TBC until confirmed. Actual day-to-day spending, transfers and bank balances are never copied.</p>
      <h3>Recurring bills</h3>
      {setup.candidates.length ? <div className="month-setup-list">{setup.candidates.map(({ id, transaction, duplicate }) => (
        <label className={`month-setup-row ${duplicate ? 'is-duplicate' : ''}`} key={`bill-${id}`}>
          <input type="checkbox" disabled={duplicate} checked={!duplicate && selectedBills.has(id)} onChange={() => toggle(setSelectedBills, id)} />
          <div className="grow"><div className="row-title">{transaction.desc}</div><div className="muted">{transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || transaction.paidBy || 'Payer TBC'} · {ownedRecordAccountLabel(transaction, accountMap, peopleMap)}</div><div className="muted">New bill starts Unpaid · exact date TBC</div></div>
          <div className="month-setup-row-end"><span className="money">{formatMoney(transaction.amount)}</span>{duplicate && <span className="status-pill neutral">Already exists</span>}</div>
        </label>
      ))}</div> : <div className="empty">No recurring bills available.</div>}

      <h3>Regular income</h3>
      {setup.incomeCandidates.length ? <div className="month-setup-list">{setup.incomeCandidates.map(({ id, record, duplicate, mode }) => (
        <label className={`month-setup-row ${duplicate ? 'is-duplicate' : ''}`} key={`income-${id}`}>
          <input type="checkbox" disabled={duplicate} checked={!duplicate && selectedIncome.has(id)} onChange={() => toggle(setSelectedIncome, id)} />
          <div className="grow"><div className="row-title">{record.description}</div><div className="muted">{record.receivedByLabel || peopleMap[record.receivedBy]?.label || record.receivedBy || 'Recipient TBC'} · {ownedRecordAccountLabel(record, accountMap, peopleMap)}</div><div className="muted">{mode === 'fixed' ? 'Expected amount carried forward' : 'Amount must be confirmed for the new month'} · starts Expected</div></div>
          <div className="month-setup-row-end"><span className="money">{mode === 'fixed' ? formatMoney(record.amount) : 'TBC'}</span>{duplicate && <span className="status-pill neutral">Already exists</span>}</div>
        </label>
      ))}</div> : <div className="empty">No regular income templates available.</div>}

      <div className="total-line"><span>Selected records</span><span>{selectedCount}</span></div>
      <div className="total-line"><span>Recurring bills</span><span className="money">{formatMoney(billTotal)}</span></div>
      <div className="total-line"><span>Fixed expected income</span><span className="money green">{formatMoney(fixedIncomeTotal)}</span></div>
      <div className="actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={selectedCount === 0} onClick={() => onConfirm({ billIds: [...selectedBills], incomeIds: [...selectedIncome] })}>Set Up Month</button></div>
    </SimpleModal>
  );
}

function Savings'''
app = app[:modal.start()] + new_modal + app[modal.end():]

# RecordModal income expected/received and amount-TBC support.
app = replace_once(app,
    "  const [amount, setAmount] = useState(transaction?.amount || income?.amount || '');",
    "  const [amount, setAmount] = useState(income?.amountConfirmed === false ? '' : transaction?.amount || income?.amount || '');",
    'record amount initial')
app = replace_once(app,
    "  const [incomeType, setIncomeType] = useState(income?.incomeType || '');",
    "  const [incomeType, setIncomeType] = useState(income?.incomeType || '');\n  const [incomeStatus, setIncomeStatus] = useState(income?.incomeStatus || 'received');",
    'income status state')
app = replace_once(app,
    "    if (!(Number(amount) > 0)) {\n      setFormError('Enter an amount greater than zero.');\n      return;\n    }",
    "    const hasPositiveAmount = Number(amount) > 0;\n    if (!hasPositiveAmount && !(mode === 'income' && incomeStatus === 'expected')) {\n      setFormError('Enter an amount greater than zero.');\n      return;\n    }",
    'amount validation')
app = replace_once(app,
    "      const issues = buildConfirmationIssues(existingIssues, {\n        dateConfirmed,\n        receivedBy,\n        account,\n        kind: 'income',\n      });",
    "      const amountConfirmed = hasPositiveAmount;\n      const issues = buildConfirmationIssues(existingIssues, {\n        dateConfirmed,\n        receivedBy,\n        account,\n        amountConfirmed,\n        incomeStatus,\n        kind: 'income',\n      });",
    'income issues')
app = replace_once(app,
    "          amount,\n          description,\n          incomeType,",
    "          amount: amountConfirmed ? amount : 0,\n          amountConfirmed,\n          incomeStatus,\n          recurrenceMode: income?.recurrenceMode || 'manual',\n          description,\n          incomeType,",
    'income record fields')

income_ui_anchor = """          <div className=\"form-grid\">
            <ReferenceSelect id=\"income-received-by\" label=\"Received By\" value={receivedBy} options={peopleOptions} onChange={setReceivedBy} />
            <ReferenceSelect id=\"income-account\" label=\"Account\" value={account} options={accountOptions} onChange={setAccount} />
          </div>"""
income_ui_new = income_ui_anchor + """
          <fieldset className=\"choice-group\">
            <legend>Income status</legend>
            <label className={incomeStatus === 'expected' ? 'choice-card selected' : 'choice-card'}>
              <input type=\"radio\" name=\"income-status\" checked={incomeStatus === 'expected'} onChange={() => setIncomeStatus('expected')} />
              <span><strong>Expected</strong><small>Planning income; completed months cannot be Ready until receipt is confirmed.</small></span>
            </label>
            <label className={incomeStatus === 'received' ? 'choice-card selected' : 'choice-card'}>
              <input type=\"radio\" name=\"income-status\" checked={incomeStatus === 'received'} onChange={() => setIncomeStatus('received')} />
              <span><strong>Received</strong><small>Money has actually arrived; amount is required.</small></span>
            </label>
          </fieldset>"""
app = replace_once(app, income_ui_anchor, income_ui_new, 'income status UI')

app = replace_once(app,
    "function buildConfirmationIssues(existingIssues, { dateConfirmed, paidBy, receivedBy, account, kind }) {\n  const issues = new Set((existingIssues || []).filter((issue) => issue === 'other'));",
    "function buildConfirmationIssues(existingIssues, { dateConfirmed, paidBy, receivedBy, account, amountConfirmed = true, incomeStatus = 'received', kind }) {\n  const issues = new Set((existingIssues || []).filter((issue) => issue === 'other'));",
    'confirmation helper signature')
app = replace_once(app,
    "  if (kind === 'income' && receivedBy === 'unassigned') issues.add('receivedBy');\n  if ((kind === 'expense' || kind === 'income' || kind === 'movement') && account === 'unassigned') issues.add('account');",
    "  if (kind === 'income' && receivedBy === 'unassigned') issues.add('receivedBy');\n  if (kind === 'income' && !amountConfirmed) issues.add('amount');\n  if (kind === 'income' && incomeStatus === 'expected') issues.add('received');\n  if ((kind === 'expense' || kind === 'income' || kind === 'movement') && account === 'unassigned') issues.add('account');",
    'confirmation helper fields')

write('src/App.jsx', app)

# Overview status should treat normal copied expected-income flags as planning, not a headline.
overview = read('src/overview-status.js')
if "month_copy" not in overview or "transaction" in overview:
    # Replace the small helper completely for clarity.
    write('src/overview-status.js', r'''function isRoutineCopiedPlanningRecord(record) {
  if (record?.source !== 'month_copy') return false;
  const issues = record.confirmationIssues || [];
  if (record.type === 'expense') return issues.every((issue) => issue === 'date');
  return issues.every((issue) => ['date','amount','received'].includes(issue));
}

export function overviewActionableIncompleteCount(summary) {
  if (!summary) return 0;
  if (summary.isComplete) return summary.incompleteRecords || 0;
  const expenses = (summary.expenseTransactions || []).filter((record) => record.needsConfirmation && !isRoutineCopiedPlanningRecord(record)).length;
  const income = (summary.incomeRecords || []).filter((record) => record.needsConfirmation && !isRoutineCopiedPlanningRecord(record)).length;
  const movements = (summary.transactions || []).filter((record) => record.type !== 'expense' && record.needsConfirmation && !isRoutineCopiedPlanningRecord(record)).length;
  return expenses + income + movements;
}
''')
else:
    raise SystemExit('Unexpected overview-status.js shape')

# Storage does not need a new top-level field; v10 is carried by finance migration.
# Add release notes/version.
version = '2026-08-30-owner-income-v10'
write('public/version.json', json.dumps({'version': version}, indent=2) + '\n')
manifest = json.loads(read('public/manifest.webmanifest'))
manifest['start_url'] = f'/penny-budget/?v={version}'
write('public/manifest.webmanifest', json.dumps(manifest, indent=2) + '\n')

changelog = read('CHANGELOG.md')
entry = '''## 2026-08-30 — Owner-specific accounts and regular income carry-forward\n\n- Prevented TBC same-bank accounts used by multiple payers from being treated as one funding pot.\n- Added a reviewable selected-month account split that creates owner-specific accounts without rewriting historical months.\n- Start New Month now carries regular income templates as Expected: Child Benefit/Child Maintenance keep their expected amount; wages and variable benefits require the new month amount to be confirmed.\n- Added Expected/Received income status and Amount TBC support; completed evidence cannot be Ready while expected/TBC income remains.\n- Monthly budget settings are copied forward when present, but current bank balances and actual day-to-day spending are never copied.\n\n'''
write('CHANGELOG.md', entry + changelog)

# Tests.
write('scripts/owner-income-v10-test.mjs', r'''import assert from 'node:assert/strict';
import { createBlankState, migrateState, monthSummary, normaliseIncomeRecord, normaliseTransaction } from '../src/finance.js';
import { buildMonthAccountSplitPlan } from '../src/account-resolution.js';
import { buildMonthSetupCopies, recurringBillSetup, recurringIncomeMode } from '../src/month-setup.js';
import { appReducer } from '../src/state.js';

const p1 = { id: 'p1', label: 'Person 1' };
const p2 = { id: 'p2', label: 'Person 2' };
const ambiguous = { id: 'legacy-bank', label: 'Bank', ownerId: 'unassigned' };
const base = {
  ...createBlankState(), people: [p1,p2], accounts: [ambiguous], budgetsByMonth: { '2026-09': { household: 800 } },
  txnsByMonth: {
    '2026-09': [
      normaliseTransaction({ id:'b1', type:'expense', date:'2026-09-02', amount:100, desc:'Bill A', category:'other', expenseClass:'fixed', paid:true, paidBy:'p1', account:'legacy-bank', confirmationIssues:[] }),
      normaliseTransaction({ id:'b2', type:'expense', date:'2026-09-03', amount:200, desc:'Bill B', category:'other', expenseClass:'fixed', paid:true, paidBy:'p2', account:'legacy-bank', confirmationIssues:[] }),
    ],
    '2026-10': [
      normaliseTransaction({ id:'o1', type:'expense', date:'2026-10-02', amount:100, desc:'Bill A', category:'other', expenseClass:'fixed', paid:false, paidBy:'p1', account:'legacy-bank', confirmationIssues:['date'], dateConfirmed:false, source:'month_copy' }),
      normaliseTransaction({ id:'o2', type:'expense', date:'2026-10-03', amount:200, desc:'Bill B', category:'other', expenseClass:'fixed', paid:false, paidBy:'p2', account:'legacy-bank', confirmationIssues:['date'], dateConfirmed:false, source:'month_copy' }),
    ],
  },
  incomeByMonth: {
    '2026-09': [
      normaliseIncomeRecord({ id:'cb', date:'2026-09-22', amount:100, description:'Child Benefit', incomeType:'Child Benefit', receivedBy:'p2', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
      normaliseIncomeRecord({ id:'cm', date:'2026-09-11', amount:300, description:'Child Maintenance', incomeType:'Child Maintenance', receivedBy:'p2', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
      normaliseIncomeRecord({ id:'pay1', date:'2026-09-01', amount:2500, description:'Paycheck', incomeType:'Employment', receivedBy:'p1', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
      normaliseIncomeRecord({ id:'uc', date:'2026-09-05', amount:1200, description:'Universal Credit', incomeType:'Benefits', receivedBy:'p2', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
      normaliseIncomeRecord({ id:'reward', date:'2026-09-15', amount:50, description:'One off reward', incomeType:'Reward', receivedBy:'p1', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
    ],
  },
  bankBalancesByMonth: { '2026-10': [{ id:'legacy-bank', label:'Bank', balance:50, ownerId:'unassigned', ownerLabel:'' }] },
};

const ambiguousSummary = monthSummary(base, '2026-10');
assert.equal(ambiguousSummary.accountFundingPlan.length, 1);
assert.equal(ambiguousSummary.accountFundingPlan[0].ambiguousAccount, true);
assert.equal(ambiguousSummary.hasAmbiguousFundingAccounts, true);
assert.equal(ambiguousSummary.totalTransferNeeded, null);

let counter = 0;
const splitPlan = buildMonthAccountSplitPlan(base, '2026-10', 'legacy-bank', () => `new-${++counter}`);
assert.equal(splitPlan.mappings.length, 2);
const split = appReducer(base, { type:'SPLIT_ACCOUNT_FOR_MONTH', monthKey:'2026-10', sourceAccountId:'legacy-bank', sourceAccountLabel:'Bank', mappings:splitPlan.mappings, peopleLabels:{p1:'Person 1',p2:'Person 2'}, auditAt:'2026-09-30T12:00:00Z' });
assert.equal(split.txnsByMonth['2026-09'].every((row) => row.account === 'legacy-bank'), true, 'Historical month must not be rewritten.');
assert.equal(new Set(split.txnsByMonth['2026-10'].map((row) => row.account)).size, 2, 'Current month must use two distinct account IDs.');
assert.equal(split.bankBalancesByMonth['2026-10'], undefined, 'Combined current-month balance must be cleared after split.');
assert.equal(monthSummary(split, '2026-10').accountFundingPlan.length, 2);

assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][0]), 'fixed');
assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][1]), 'fixed');
assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][2]), 'confirm');
assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][3]), 'confirm');
assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][4]), 'manual');

const cleanTarget = { ...base, txnsByMonth:{...base.txnsByMonth, '2026-10':[]}, incomeByMonth:{...base.incomeByMonth, '2026-10':[]} };
const setup = recurringBillSetup(cleanTarget, '2026-10');
assert.equal(setup.availableCount, 2);
assert.equal(setup.availableIncomeCount, 4, 'One-off reward must not copy.');
const copies = buildMonthSetupCopies(cleanTarget, '2026-10', { billIds: setup.candidates.map((x)=>x.id), incomeIds: setup.incomeCandidates.map((x)=>x.id) }, (prefix)=>`${prefix}-${++counter}`);
assert.equal(copies.bills.length, 2);
assert.equal(copies.income.length, 4);
const childBenefit = copies.income.find((row)=>row.description === 'Child Benefit');
const pay = copies.income.find((row)=>row.description === 'Paycheck');
assert.equal(childBenefit.amount, 100);
assert.equal(childBenefit.amountConfirmed, true);
assert.equal(childBenefit.incomeStatus, 'expected');
assert.equal(pay.amount, 0);
assert.equal(pay.amountConfirmed, false);
assert.equal(pay.confirmationIssues.includes('amount'), true);

const started = appReducer(cleanTarget, { type:'START_NEW_MONTH', monthKey:'2026-10', sourceMonthKey:'2026-09', bills:copies.bills, income:copies.income, auditAt:'2026-09-30T12:00:00Z' });
assert.equal(started.incomeByMonth['2026-10'].length, 4);
assert.deepEqual(started.budgetsByMonth['2026-10'], { household:800 });
const summary = monthSummary(started, '2026-10');
assert.equal(summary.income, 400, 'Only fixed expected amounts count until pay/benefits amounts are confirmed.');
assert.equal(summary.expectedIncome, 400);
assert.equal(summary.tbcIncomeCount, 2);

const old = migrateState({ version:9, incomeByMonth:{'2026-08':[{id:'old',date:'2026-08-01',amount:1000,description:'Legacy pay',incomeType:'Employment',receivedBy:'p1',account:'legacy-bank'}]}, people:[p1], accounts:[ambiguous] }, new Date(2026,7,1));
assert.equal(old.version, 10);
assert.equal(old.incomeByMonth['2026-08'][0].amountConfirmed, true);
assert.equal(old.incomeByMonth['2026-08'][0].incomeStatus, 'received');

console.log('Penny owner-specific account and regular-income carry-forward tests passed');
''')

pkg = json.loads(read('package.json'))
pkg['scripts']['test'] = pkg['scripts']['test'].replace('node scripts/source-audit.mjs', 'node scripts/owner-income-v10-test.mjs && node scripts/source-audit.mjs')
write('package.json', json.dumps(pkg, indent=2) + '\n')

# Update source audit expectations.
audit = read('scripts/source-audit.mjs')
audit = audit.replace("assert.match(files.app, /In progress — this month is planning data, not final mortgage evidence/);\n", "")
insert_after = "  assert.match(files.app, /Current bank balance: TBC/);\n"
if insert_after not in audit:
    raise SystemExit('source audit anchor missing')
audit = audit.replace(insert_after, insert_after + "  assert.match(files.app, /Separate bank accounts required/);\n  assert.match(files.app, /Income status/);\n  assert.match(files.finance, /CURRENT_STATE_VERSION = 10/);\n  assert.match(files.finance, /incomeStatus/);\n  assert.match(files.finance, /hasAmbiguousFundingAccounts/);\n  assert.match(files.state, /SPLIT_ACCOUNT_FOR_MONTH/);\n  assert.match(files.state, /START_NEW_MONTH/);\n")
write('scripts/source-audit.mjs', audit)

# Update month setup source audit to new wording/model.
msa = read('scripts/month-setup-source-audit.mjs')
msa = msa.replace("assert.match(app, /Start New Month/, 'Overview must expose a Start New Month action.');", "assert.match(app, /Set Up Month/, 'Overview must expose a month setup action.');")
msa = msa.replace("assert.match(state, /case 'COPY_RECURRING_BILLS'/, 'Recurring bill copy must be handled atomically by the reducer.');", "assert.match(state, /case 'START_NEW_MONTH'/, 'Bills and regular income must be copied atomically by the reducer.');")
msa = msa.replace("console.log('Penny unified month setup source audit passed');", "assert.match(monthSetup, /recurringIncomeMode/);\nassert.match(monthSetup, /incomeStatus: 'expected'/);\nconsole.log('Penny unified month setup source audit passed');")
write('scripts/month-setup-source-audit.mjs', msa)

print('Applied owner-specific account and regular-income v10 patch')
