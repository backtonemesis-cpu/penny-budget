import assert from 'node:assert/strict';
import { createBlankState, monthSummary, normaliseIncomeRecord, normaliseTransaction } from '../src/finance.js';
import { buildRecurringBillCopies, recurringBillKey, recurringBillSetup, recurringBillTargetDate } from '../src/month-setup.js';
import { appReducer } from '../src/state.js';

const state = {
  ...createBlankState(),
  people: [{ id: 'p1', label: 'Person 1' }, { id: 'p2', label: 'Person 2' }],
  accounts: [
    { id: 'a1', label: 'Account 1', ownerId: 'p1' },
    { id: 'a2', label: 'Account 2', ownerId: 'p2' },
  ],
  incomeByMonth: {
    '2026-08': [normaliseIncomeRecord({ id: 'income-aug', date: '2026-08-01', amount: 1000, description: 'Income', incomeType: 'Employment', receivedBy: 'p1', account: 'a1', confirmationIssues: [] }, '2026-08')],
  },
  txnsByMonth: {
    '2026-08': [
      normaliseTransaction({ id: 'rent-aug', type: 'expense', date: '2026-08-31', amount: 900, desc: 'Rent', category: 'rent_mortgage', expenseClass: 'fixed', paid: true, paidBy: 'p1', account: 'a1', confirmationIssues: [] }),
      normaliseTransaction({ id: 'tax-aug', type: 'expense', date: '2026-08-05', amount: 150, desc: 'Council tax', category: 'council_tax', expenseClass: 'fixed', paid: true, paidBy: 'p2', account: 'a2', confirmationIssues: [] }),
      normaliseTransaction({ id: 'shopping-aug', type: 'expense', date: '2026-08-10', amount: 300, desc: 'Shopping', category: 'groceries', expenseClass: 'variable', paid: true, paidBy: 'household', account: 'a1', confirmationIssues: [] }),
      normaliseTransaction({ id: 'transfer-aug', type: 'internal_transfer', date: '2026-08-20', amount: 100, desc: 'Transfer', category: 'internal_transfer', account: 'a1', confirmationIssues: [] }),
    ],
    '2026-09': [
      normaliseTransaction({ id: 'rent-sep-existing', type: 'expense', date: '2026-09-01', amount: 950, desc: 'Rent', category: 'rent_mortgage', expenseClass: 'fixed', paid: false, paidBy: 'p1', account: 'a1', confirmationIssues: ['date'], dateConfirmed: false }),
    ],
  },
};

assert.equal(recurringBillTargetDate('2026-01-31', '2026-02'), '2026-02-28', 'Copied bill placement must clamp safely to the target month length.');
assert.equal(recurringBillTargetDate('2024-01-31', '2024-02'), '2024-02-29', 'Leap-year month placement must remain valid.');

const setup = recurringBillSetup(state, '2026-09');
assert.equal(setup.sourceMonthKey, '2026-08');
assert.equal(setup.candidates.length, 2, 'Only fixed expenses from the previous month are recurring-bill candidates.');
assert.equal(setup.availableCount, 1, 'An equivalent fixed bill already present in the target month must be treated as a duplicate even when the amount changed.');
assert.equal(setup.duplicateCount, 1);
assert.equal(setup.candidates.find((candidate) => candidate.id === 'rent-aug').duplicate, true);
assert.equal(setup.candidates.find((candidate) => candidate.id === 'tax-aug').duplicate, false);
assert.equal(recurringBillKey(setup.candidates.find((candidate) => candidate.id === 'rent-aug').transaction), recurringBillKey(state.txnsByMonth['2026-09'][0]));

let counter = 0;
const copies = buildRecurringBillCopies(state, '2026-09', setup.candidates.map((candidate) => candidate.id), () => `copied-${++counter}`);
assert.equal(copies.length, 1, 'Duplicate target bills must never be copied a second time.');
assert.equal(copies[0].desc, 'Council tax');
assert.equal(copies[0].paid, false, 'Copied recurring bills must always start unpaid.');
assert.equal(copies[0].source, 'month_copy');
assert.equal(copies[0].date, '2026-09-05');
assert.equal(copies[0].dateConfirmed, false, 'Copied dates are planning assumptions, not evidence.');
assert.equal(copies[0].confirmationIssues.includes('date'), true);
assert.equal(copies[0].accountOwnerId, 'p2', 'Copied bills must snapshot the current bank-account owner.');
assert.equal(copies[0].accountOwnerLabel, 'Person 2');
assert.equal(copies.some((row) => row.expenseClass === 'variable'), false, 'Ordinary variable spending must never be copied by Start New Month.');
assert.equal(copies.some((row) => row.type !== 'expense'), false, 'Transfers and movements must never be copied by Start New Month.');

const copiedOnce = appReducer(state, {
  type: 'COPY_RECURRING_BILLS',
  monthKey: '2026-09',
  sourceMonthKey: '2026-08',
  bills: copies,
  auditAt: '2026-08-31T18:00:00.000Z',
  auditId: 'audit-month-setup',
});
assert.equal(copiedOnce.txnsByMonth['2026-09'].filter((row) => row.expenseClass === 'fixed').length, 2);
assert.equal(copiedOnce.auditLog[0].action, 'copy_bills');
assert.equal(copiedOnce.auditLog[0].entityType, 'monthly_setup');
assert.equal(copiedOnce.auditLog[0].after.sourceMonthKey, '2026-08');
assert.equal(copiedOnce.auditLog[0].after.copiedBills.length, 1);

const copiedTwice = appReducer(copiedOnce, {
  type: 'COPY_RECURRING_BILLS',
  monthKey: '2026-09',
  sourceMonthKey: '2026-08',
  bills: [{ ...copies[0], id: 'another-id' }],
  auditAt: '2026-08-31T18:01:00.000Z',
  auditId: 'audit-month-setup-repeat',
});
assert.equal(copiedTwice.txnsByMonth['2026-09'].filter((row) => row.expenseClass === 'fixed').length, 2, 'Starting the same month twice must not duplicate recurring bills.');
assert.equal(copiedTwice.auditLog.length, copiedOnce.auditLog.length, 'A no-op duplicate month setup must not create a misleading audit entry.');

assert.equal(copiedOnce.incomeByMonth['2026-09'], undefined, 'Start New Month must not copy income as received evidence.');
assert.equal(monthSummary(copiedOnce, '2026-09').remainingBills, 1100, 'Copied bills must immediately participate in the unpaid-bill and funding plan.');

const clearedBalances = appReducer({
  ...copiedOnce,
  bankBalancesByMonth: { '2026-09': [{ id: 'a2', label: 'Account 2', balance: 50, ownerId: 'p2', ownerLabel: 'Person 2' }] },
}, {
  type: 'SET_BANK_BALANCES',
  monthKey: '2026-09',
  items: [],
  auditAt: '2026-08-31T18:02:00.000Z',
  auditId: 'audit-clear-balance',
});
assert.equal(clearedBalances.bankBalancesByMonth['2026-09'], undefined, 'Clearing the Overview bank-balance input must restore TBC rather than store a false confirmed zero.');

console.log('Penny unified month setup tests passed');
