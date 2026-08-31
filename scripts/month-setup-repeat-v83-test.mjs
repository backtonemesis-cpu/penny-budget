import assert from 'node:assert/strict';
import { buildRecurringBillCopies, recurringBillSetup } from '../src/month-setup.js';

const septemberBill = {
  id: 'bill_sep_council_tax',
  type: 'expense',
  expenseClass: 'fixed',
  amount: 180,
  category: 'housing',
  date: '2026-09-01',
  desc: 'Council Tax',
  paid: true,
  paidBy: 'marius',
  paidByLabel: 'Marius',
  account: 'legacy_santander_account',
  accountLabel: 'Santander',
  accountOwnerId: 'marius',
  accountOwnerLabel: 'Marius',
  confirmationIssues: [],
  dateConfirmed: true,
  needsConfirmation: false,
  source: 'legacy',
};

const state = {
  customCats: [],
  people: [{ id: 'marius', label: 'Marius' }],
  accounts: [{ id: 'santander_marius', label: 'Santander', ownerId: 'marius' }],
  txnsByMonth: {
    '2026-09': [septemberBill],
    '2026-10': [],
  },
  incomeByMonth: {},
};

const before = recurringBillSetup(state, '2026-10');
assert.equal(before.availableCount, 1, 'The September bill should initially be available to copy into October.');

const firstCopies = buildRecurringBillCopies(state, '2026-10', [septemberBill.id], () => 'txn_oct_council_tax');
assert.equal(firstCopies.length, 1, 'The selected bill should copy once.');
assert.equal(firstCopies[0].account, 'santander_marius', 'Month setup should resolve the historical Santander reference to the current account.');

const afterFirstCopyState = {
  ...state,
  txnsByMonth: {
    ...state.txnsByMonth,
    '2026-10': firstCopies,
  },
};

const after = recurringBillSetup(afterFirstCopyState, '2026-10');
assert.equal(after.availableCount, 0, 'Once the bill is copied, Set Up Month must have no remaining copy of that bill available.');
assert.equal(after.totalAvailableCount, 0, 'The setup banner should be able to disappear once all selected recurring items are imported.');

const secondCopies = buildRecurringBillCopies(afterFirstCopyState, '2026-10', [septemberBill.id], () => 'txn_oct_duplicate');
assert.equal(secondCopies.length, 0, 'Clicking setup again must not create a duplicate bill.');

console.log('v83 month setup repeat-import regression passed');
