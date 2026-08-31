import { MAX_AUDIT_ENTRIES, createId, previousMonthKey } from './finance.js';
import { getMonthAccounts, getMonthPeople } from './month-scope.js';

function normaliseLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function meaningfulLabel(value) {
  const label = normaliseLabel(value);
  return label && !['tbc', 'unassigned', 'unknown', 'account'].includes(label) ? label : '';
}

function ownerStrippedLabel(value, ownerLabel) {
  let label = meaningfulLabel(value);
  const owner = meaningfulLabel(ownerLabel);
  if (!label) return '';
  if (owner) {
    const ownerTokens = new Set(owner.split(' '));
    label = label.split(' ').filter((token) => !ownerTokens.has(token)).join(' ').trim();
  }
  return label;
}

function sameRecurringExpense(left, right) {
  if (!left || !right || left.type !== 'expense' || right.type !== 'expense') return false;
  return normaliseLabel(left.desc) === normaliseLabel(right.desc)
    && normaliseLabel(left.category) === normaliseLabel(right.category)
    && String(left.paidBy || '') === String(right.paidBy || '');
}

function labelsMatch(evidence, candidate, ownerLabel) {
  const evidenceKey = ownerStrippedLabel(evidence, ownerLabel);
  const candidateKey = ownerStrippedLabel(candidate, ownerLabel);
  if (!evidenceKey || !candidateKey) return false;
  if (evidenceKey === candidateKey) return true;
  if (evidenceKey.length < 4 || candidateKey.length < 4) return false;
  return evidenceKey.includes(candidateKey) || candidateKey.includes(evidenceKey);
}

function personLabel(people, personId, fallback = '') {
  if (personId === 'household') return 'Joint';
  return (people || []).find((person) => person.id === personId)?.label || fallback || '';
}

export function resolveOwnedExpenseAccount(transaction, { accounts = [], people = [], previousTransactions = [] } = {}) {
  if (!transaction || transaction.type !== 'expense') return null;
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const currentAccount = accountMap.get(transaction.account);
  if (currentAccount) return currentAccount;

  const paidBy = transaction.paidBy || 'unassigned';
  if (!paidBy || ['unassigned', 'household'].includes(paidBy)) return null;

  const ownerCandidates = accounts.filter((account) => account.ownerId === paidBy);
  if (!ownerCandidates.length) return null;
  const ownerLabel = personLabel(people, paidBy, transaction.paidByLabel);

  const previousMatches = previousTransactions.filter((row) => sameRecurringExpense(transaction, row));
  const directIds = new Set();
  previousMatches.forEach((row) => {
    const sourceAccount = accountMap.get(row.account);
    if (sourceAccount?.ownerId === paidBy) directIds.add(sourceAccount.id);
  });
  if (directIds.size === 1) return accountMap.get([...directIds][0]);
  if (directIds.size > 1) return null;

  const evidenceLabels = [
    transaction.accountLabel,
    transaction.legacyAccountLabel,
    ...previousMatches.flatMap((row) => [row.accountLabel, row.legacyAccountLabel]),
  ].filter((label) => meaningfulLabel(label));
  const matchedIds = new Set();
  evidenceLabels.forEach((label) => {
    ownerCandidates.forEach((candidate) => {
      if (labelsMatch(label, candidate.label, ownerLabel)) matchedIds.add(candidate.id);
    });
  });

  if (matchedIds.size === 1) return accountMap.get([...matchedIds][0]);
  if (matchedIds.size > 1) return null;

  // Owner-only fallback is intentionally allowed only when the selected
  // month contains exactly one account for that payer. Multiple accounts
  // remain TBC rather than being guessed.
  return ownerCandidates.length === 1 ? ownerCandidates[0] : null;
}

function repairOneExpense(row, resolvedAccount, people) {
  const confirmationIssues = (row.confirmationIssues || []).filter((issue) => issue !== 'account');
  const ownerLabel = personLabel(people, resolvedAccount.ownerId, row.paidByLabel);
  return {
    ...row,
    account: resolvedAccount.id,
    accountLabel: resolvedAccount.label,
    accountOwnerId: resolvedAccount.ownerId || 'unassigned',
    accountOwnerLabel: ownerLabel,
    confirmationIssues,
    needsConfirmation: confirmationIssues.length > 0,
  };
}

export function repairAccountReferences(state, now = new Date()) {
  if (!state || typeof state !== 'object') return state;
  const monthKeys = Object.keys(state.txnsByMonth || {}).sort();
  if (!monthKeys.length) return state;

  const repairedByMonth = {};
  const repairs = [];

  monthKeys.forEach((monthKey) => {
    const accounts = getMonthAccounts(state, monthKey);
    const people = getMonthPeople(state, monthKey);
    const activeAccountIds = new Set(accounts.map((account) => account.id));
    const previousKey = previousMonthKey(monthKey);
    const previousRows = repairedByMonth[previousKey] || state.txnsByMonth?.[previousKey] || [];
    const rows = state.txnsByMonth?.[monthKey] || [];

    repairedByMonth[monthKey] = rows.map((row) => {
      const accountMissing = !row.account || row.account === 'unassigned' || !activeAccountIds.has(row.account);
      if (row.type !== 'expense' || row.expenseClass !== 'fixed' || !accountMissing || !accounts.length) return row;

      const resolved = resolveOwnedExpenseAccount(row, { accounts, people, previousTransactions: previousRows });
      if (!resolved || resolved.id === row.account) return row;

      const after = repairOneExpense(row, resolved, people);
      repairs.push({
        monthKey,
        before: row,
        after,
        ownerDisplay: personLabel(people, after.accountOwnerId, after.paidByLabel),
      });
      return after;
    });
  });

  if (!repairs.length) return state;

  const at = now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const auditEntries = repairs.map(({ monthKey, before, after, ownerDisplay }) => ({
    id: createId('audit'),
    at,
    action: 'account_reference_repair',
    entityType: 'expense',
    entityId: after.id || '',
    monthKey,
    label: `Resolved ${after.desc || 'expense'} account to ${ownerDisplay || 'TBC'} · ${after.accountLabel}`,
    before,
    after,
  }));

  return {
    ...state,
    txnsByMonth: { ...(state.txnsByMonth || {}), ...repairedByMonth },
    auditLog: [...auditEntries, ...(state.auditLog || [])].slice(0, MAX_AUDIT_ENTRIES),
  };
}
