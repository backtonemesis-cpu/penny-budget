import assert from 'node:assert/strict';
import { repairAccountReferences, resolveOwnedExpenseAccount } from '../src/account-reference-repair.js';
import { monthSummary } from '../src/finance.js';
import { buildRecurringBillCopies } from '../src/month-setup.js';

const people = [
  { id: 'marius', label: 'Marius' },
  { id: 'vesta', label: 'Vesta' },
];

const accounts = [
  { id: 'santander', label: 'Santander', ownerId: 'marius' },
  { id: 'chase', label: 'Chase', ownerId: 'marius' },
  { id: 'credit-card', label: 'Credit Card', ownerId: 'marius' },
  { id: 'lloyds-marius', label: 'Lloyds Marius', ownerId: 'marius' },
  { id: 'natwest', label: 'NatWest', ownerId: 'vesta' },
  { id: 'lloyds-vesta', label: 'Lloyds Vesta', ownerId: 'vesta' },
];

function expense(overrides = {}) {
  return {
    id: overrides.id || 'txn',
    type: 'expense',
    amount: overrides.amount || 100,
    category: overrides.category || 'housing',
    date: overrides.date || '2026-08-01',
    desc: overrides.desc || 'Test bill',
    expenseClass: 'fixed',
    paid: false,
    paidBy: overrides.paidBy || 'marius',
    paidByLabel: overrides.paidBy === 'vesta' ? 'Vesta' : 'Marius',
    account: overrides.account ?? 'unassigned',
    accountLabel: overrides.accountLabel ?? '',
    accountOwnerId: overrides.accountOwnerId ?? 'unassigned',
    accountOwnerLabel: overrides.accountOwnerLabel ?? '',
    confirmationIssues: overrides.confirmationIssues || ['date', 'account'],
    dateConfirmed: false,
    needsConfirmation: true,
    source: overrides.source || 'month_copy',
  };
}

const augustMarius = expense({
  id: 'aug-m',
  paidBy: 'marius',
  account: 'legacy-lloyds',
  accountLabel: 'Lloyds',
  date: '2026-08-03',
  desc: 'Lloyds bill M',
});
const augustVesta = expense({
  id: 'aug-v',
  paidBy: 'vesta',
  account: 'legacy-lloyds',
  accountLabel: 'Lloyds',
  date: '2026-08-04',
  desc: 'Lloyds bill V',
});
const septemberMarius = expense({
  id: 'sep-m',
  paidBy: 'marius',
  date: '2026-09-03',
  desc: 'Lloyds bill M',
});
const septemberVesta = expense({
  id: 'sep-v',
  paidBy: 'vesta',
  date: '2026-09-04',
  desc: 'Lloyds bill V',
});

const state = {
  version: 10,
  people,
  accounts,
  txnsByMonth: {
    '2026-08': [augustMarius, augustVesta],
    '2026-09': [septemberMarius, septemberVesta],
  },
  incomeByMonth: {},
  customCats: [],
  hiddenCats: [],
  savingsByMonth: {},
  bankBalancesByMonth: {},
  monthMetaByMonth: {},
  savingsGoal: 0,
  savingsContrib: 0,
  budgetsByMonth: {},
  dueDays: {},
  auditLog: [],
};

const repaired = repairAccountReferences(state, new Date('2026-08-31T12:45:00Z'));
assert.equal(repaired.txnsByMonth['2026-08'][0].account, 'lloyds-marius');
assert.equal(repaired.txnsByMonth['2026-08'][1].account, 'lloyds-vesta');
assert.equal(repaired.txnsByMonth['2026-09'][0].account, 'lloyds-marius');
assert.equal(repaired.txnsByMonth['2026-09'][1].account, 'lloyds-vesta');
assert.deepEqual(repaired.txnsByMonth['2026-09'][0].confirmationIssues, ['date']);
assert.equal(repaired.txnsByMonth['2026-09'][0].needsConfirmation, true, 'Date evidence must remain outstanding');
assert.ok(repaired.auditLog.some((entry) => entry.action === 'account_reference_repair'), 'Repairs must be audit logged');

const septemberSummary = monthSummary(repaired, '2026-09');
assert.equal(septemberSummary.hasAmbiguousFundingAccounts, false, 'Owner-specific Lloyds accounts must not collapse into TBC');
assert.deepEqual(new Set(septemberSummary.accountFundingPlan.map((row) => row.account)), new Set(['lloyds-marius', 'lloyds-vesta']));
assert.equal(septemberSummary.hasUnconfirmedAccountOwners, false);

const futureState = {
  ...state,
  txnsByMonth: { '2026-08': [augustMarius, augustVesta] },
};
let sequence = 0;
const copies = buildRecurringBillCopies(futureState, '2026-09', ['aug-m', 'aug-v'], (prefix) => `${prefix}-${++sequence}`);
assert.equal(copies.length, 2);
assert.equal(copies.find((row) => row.paidBy === 'marius').account, 'lloyds-marius');
assert.equal(copies.find((row) => row.paidBy === 'vesta').account, 'lloyds-vesta');
assert.ok(copies.every((row) => !row.confirmationIssues.includes('account')), 'Future copies must preserve a uniquely resolved account');
assert.ok(copies.every((row) => row.confirmationIssues.includes('date')), 'Future copies must still require exact-date confirmation');

const ambiguousAccounts = [
  { id: 'lloyds-one', label: 'Lloyds Marius', ownerId: 'marius' },
  { id: 'lloyds-two', label: 'Marius Lloyds', ownerId: 'marius' },
];
const ambiguous = resolveOwnedExpenseAccount(augustMarius, { accounts: ambiguousAccounts, people, previousTransactions: [] });
assert.equal(ambiguous, null, 'Penny must not guess when more than one owner-specific account matches the evidence');

const ownerOnlyAmbiguous = resolveOwnedExpenseAccount(
  expense({ id: 'no-label', paidBy: 'marius', account: 'missing', accountLabel: '' }),
  { accounts: accounts.filter((account) => account.ownerId === 'marius'), people, previousTransactions: [] },
);
assert.equal(ownerOnlyAmbiguous, null, 'Penny must not choose among several accounts using payer alone');

console.log('v76 account reference repair regression passed');
