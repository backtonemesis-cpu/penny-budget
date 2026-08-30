import {
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
