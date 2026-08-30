import {
  createId,
  isValidDateKey,
  isValidMonthKey,
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

export function recurringBillTargetDate(sourceDate, targetMonthKey) {
  if (!isValidMonthKey(targetMonthKey)) return '';
  const [year, month] = targetMonthKey.split('-').map(Number);
  const sourceDay = isValidDateKey(sourceDate) ? Number(sourceDate.slice(8, 10)) : 1;
  const lastDay = new Date(year, month, 0).getDate();
  return `${targetMonthKey}-${String(Math.min(Math.max(sourceDay, 1), lastDay)).padStart(2, '0')}`;
}

export function recurringBillSetup(state, targetMonthKey) {
  const sourceMonthKey = previousMonthKey(targetMonthKey);
  if (!sourceMonthKey) return { sourceMonthKey: '', targetMonthKey, candidates: [], availableCount: 0, duplicateCount: 0 };

  const sourceBills = (state?.txnsByMonth?.[sourceMonthKey] || [])
    .filter((transaction) => transaction.type === 'expense' && transaction.expenseClass === 'fixed')
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  const protectedKeys = new Set(
    (state?.txnsByMonth?.[targetMonthKey] || [])
      .filter((transaction) => transaction.type === 'expense' && transaction.expenseClass === 'fixed')
      .map(recurringBillKey)
      .filter(Boolean),
  );

  const candidates = sourceBills.map((transaction) => {
    const key = recurringBillKey(transaction);
    const duplicate = !key || protectedKeys.has(key);
    if (key) protectedKeys.add(key);
    return { id: transaction.id, transaction, duplicate };
  });

  return {
    sourceMonthKey,
    targetMonthKey,
    candidates,
    availableCount: candidates.filter((candidate) => !candidate.duplicate).length,
    duplicateCount: candidates.filter((candidate) => candidate.duplicate).length,
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
    const paidByLabel = transaction.paidBy === 'household'
      ? 'Joint'
      : people[transaction.paidBy]?.label || transaction.paidByLabel || '';
    const accountLabel = account?.label || transaction.accountLabel || transaction.account || '';
    const copied = normaliseTransaction({
      ...transaction,
      id: idFactory('txn'),
      date: recurringBillTargetDate(transaction.date, targetMonthKey),
      paid: false,
      paidByLabel,
      accountLabel,
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

export function recurringBillSelectionTotal(setup, selectedIds) {
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  return roundMoney((setup?.candidates || []).reduce((sum, candidate) => (
    !candidate.duplicate && selected.has(candidate.id) ? sum + Number(candidate.transaction.amount || 0) : sum
  ), 0));
}
