import { createId } from './finance.js';

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
