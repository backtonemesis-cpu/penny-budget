import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankState } from '../src/finance.js';
import { buildMonthSetupCopies, recurringBillSetup } from '../src/month-setup.js';
import { appReducer } from '../src/state.js';

const people = [
  { id: 'marius', label: 'Marius' },
  { id: 'vesta', label: 'Vesta' },
];
const accounts = [
  { id: 'santander_marius', label: 'Santander', ownerId: 'marius' },
  { id: 'lloyds_vesta', label: 'Lloyds Vesta', ownerId: 'vesta' },
];

const state = {
  ...createBlankState(),
  people,
  accounts,
  peopleByMonth: {
    '2026-09': people,
    '2026-10': [],
  },
  accountsByMonth: {
    '2026-09': accounts,
    '2026-10': [],
  },
  txnsByMonth: {
    '2026-09': [{
      id: 'google_one_sep',
      type: 'expense',
      expenseClass: 'fixed',
      amount: 19.99,
      category: 'subscriptions',
      date: '2026-09-15',
      desc: 'Google One',
      paid: true,
      paidBy: 'legacy_marius_id',
      paidByLabel: 'Marius',
      account: 'legacy_santander_id',
      accountLabel: 'Santander',
      accountOwnerId: 'marius',
      accountOwnerLabel: 'Marius',
      confirmationIssues: [],
      dateConfirmed: true,
      needsConfirmation: false,
      source: 'legacy',
    }],
    '2026-10': [],
  },
  incomeByMonth: {
    '2026-09': [{
      id: 'child_b_sep',
      date: '2026-09-22',
      amount: 102.4,
      amountConfirmed: true,
      incomeStatus: 'received',
      recurrenceMode: 'fixed',
      description: 'Child B',
      incomeType: 'C Benefit',
      receivedBy: 'legacy_vesta_id',
      receivedByLabel: 'Vesta',
      account: 'legacy_lloyds_id',
      accountLabel: 'Lloyds Vesta',
      accountOwnerId: 'vesta',
      accountOwnerLabel: 'Vesta',
      confirmationIssues: [],
      dateConfirmed: true,
      needsConfirmation: false,
      source: 'legacy',
    }],
    '2026-10': [],
  },
};

const setup = recurringBillSetup(state, '2026-10');
assert.equal(setup.availableCount, 1, 'The recurring September bill must be available for October.');
assert.equal(setup.availableIncomeCount, 1, 'The recurring September income must be available for October.');

const copies = buildMonthSetupCopies(state, '2026-10', {
  billIds: ['google_one_sep'],
  incomeIds: ['child_b_sep'],
}, (prefix) => `${prefix}_oct`);

assert.equal(copies.bills.length, 1, 'The selected recurring bill must copy once.');
assert.equal(copies.bills[0].paidBy, 'marius', 'A visible prior-month payer label must resolve to the current Marius person id.');
assert.equal(copies.bills[0].account, 'santander_marius', 'The prior-month Santander assignment must carry into the new month.');
assert.equal(copies.bills[0].confirmationIssues.includes('paidBy'), false, 'A resolved payer must not become TBC on rollover.');
assert.equal(copies.bills[0].confirmationIssues.includes('account'), false, 'A resolved bill account must not become TBC on rollover.');

assert.equal(copies.income.length, 1, 'The selected recurring income must copy once.');
assert.equal(copies.income[0].receivedBy, 'vesta', 'A visible prior-month recipient label must resolve to the current Vesta person id.');
assert.equal(copies.income[0].account, 'lloyds_vesta', 'The prior-month Lloyds Vesta assignment must carry into the new month.');
assert.equal(copies.income[0].confirmationIssues.includes('receivedBy'), false, 'A resolved recipient must not become TBC on rollover.');
assert.equal(copies.income[0].confirmationIssues.includes('account'), false, 'A resolved income account must not become TBC on rollover.');

const started = appReducer(state, {
  type: 'START_NEW_MONTH',
  monthKey: '2026-10',
  sourceMonthKey: '2026-09',
  bills: copies.bills,
  income: copies.income,
  copyPeople: true,
  copyAccounts: true,
  audit: false,
});
assert.deepEqual(started.peopleByMonth['2026-10'], people, 'A blank target month must inherit the source month people setup.');
assert.deepEqual(started.accountsByMonth['2026-10'], accounts, 'A blank target month must inherit the source month account setup.');
assert.equal(started.txnsByMonth['2026-10'][0].account, 'santander_marius', 'The started month must retain the bill account assignment.');
assert.equal(started.incomeByMonth['2026-10'][0].account, 'lloyds_vesta', 'The started month must retain the income account assignment.');

const app = await readFile('src/App.jsx', 'utf8');
assert.match(app, /function AssignmentSelect\(/, 'Transactions must use a shared inline assignment dropdown.');
assert.match(app, /Paid by <AssignmentSelect[\s\S]*placeholder="User"/, 'Expense cards must identify the payer field instead of showing ambiguous Unassigned text.');
assert.match(app, /Received by <AssignmentSelect[\s\S]*placeholder="User"/, 'Income cards must identify the recipient field instead of showing ambiguous Unassigned text.');
assert.match(app, /placeholder="Account"/, 'Cards must identify the missing account field directly.');
assert.match(app, /onAssignTransaction=\{assignExpenseReference\}/, 'Expense assignment dropdowns must save directly from the card.');
assert.match(app, /onAssignIncome=\{assignIncomeReference\}/, 'Income assignment dropdowns must save directly from the card.');
assert.match(app, /copyPeople: Boolean\(selection\.copyPeople \|\| selection\.copyAccounts\)/, 'Set Up Month must carry selected people into the target month.');
assert.match(app, /copyAccounts: Boolean\(selection\.copyAccounts\)/, 'Set Up Month must carry selected accounts into the target month.');

console.log('v84 inline assignment and month rollover regression passed');
