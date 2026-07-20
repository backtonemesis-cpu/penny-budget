import assert from 'node:assert/strict';
import { appReducer } from '../src/state.js';
import {
  CURRENT_STATE_VERSION,
  annualSummary,
  createBlankState,
  migrateState,
  monthSummary,
  normaliseIncomeRecord,
  normaliseTransaction,
} from '../src/finance.js';
import { createBackupText, parseBackupText } from '../src/storage.js';

const state = {
  ...createBlankState(),
  people: [{ id: 'p1', label: 'Person 1' }, { id: 'p2', label: 'Person 2' }],
  accounts: [{ id: 'a1', label: 'Account 1' }, { id: 'a2', label: 'Account 2' }],
  savingsAccounts: [
    { id: 's1', label: 'Savings 1', balance: 6000 },
    { id: 's2', label: 'Savings 2', balance: 4000 },
  ],
  incomeByMonth: {
    '2026-07': [
      normaliseIncomeRecord({ id: 'i1', date: '2026-07-01', amount: 3000, description: 'Employment', incomeType: 'Employment', receivedBy: 'p1', account: 'a1' }, '2026-07'),
      normaliseIncomeRecord({ id: 'i2', date: '2026-07-05', amount: 1000, description: 'Benefits', incomeType: 'Benefits', receivedBy: 'p2', account: 'a2' }, '2026-07'),
    ],
  },
  txnsByMonth: {
    '2026-07': [
      normaliseTransaction({ id: 'e1', type: 'expense', date: '2026-07-02', amount: 1200, desc: 'Housing', category: 'rent_mortgage', expenseClass: 'fixed', paid: true, paidBy: 'p1', account: 'a1' }),
      normaliseTransaction({ id: 'e2', type: 'expense', date: '2026-07-10', amount: 200, desc: 'Council tax', category: 'council_tax', expenseClass: 'fixed', paid: false, paidBy: 'p2', account: 'a2' }),
      normaliseTransaction({ id: 'e3', type: 'expense', date: '2026-07-12', amount: 600, desc: 'Shopping', category: 'variable_household', expenseClass: 'variable', paid: true, paidBy: 'household', account: 'a1' }),
      normaliseTransaction({ id: 'm1', type: 'card_repayment', date: '2026-07-20', amount: 300, desc: 'Card repayment', category: 'card_repayment', account: 'a1' }),
    ],
  },
};

const july = monthSummary(state, '2026-07');
assert.equal(july.currentSavings, 10000);
assert.equal(july.income, 4000);
assert.equal(july.expenses, 2000);
assert.equal(july.paidExpenses, 1800);
assert.equal(july.remainingBills, 200);
assert.equal(july.fixedExpenses, 1400);
assert.equal(july.variableExpenses, 600);
assert.equal(july.savedThisMonth, 2000);
assert.equal(july.freeSavingsAfterBills, 9800);
assert.equal(july.projectedIncrease, 3800);
assert.equal(july.projectedEndSavings, 13800);
assert.equal(july.excludedMovements, 300);
assert.deepEqual(july.transferPlan, [{ key: 'p2::a2', paidBy: 'p2', account: 'a2', amount: 200, count: 1 }]);
assert.equal(july.incompleteRecords, 0);

const toggled = appReducer(state, { type: 'TOGGLE_PAID', monthKey: '2026-07', id: 'e2' });
assert.equal(monthSummary(toggled, '2026-07').remainingBills, 0);
assert.equal(monthSummary(toggled, '2026-07').projectedEndSavings, 14000);

const legacy = migrateState({
  version: 3,
  savingsBal: 1234.56,
  incomeByMonth: { '2026-07': [{ id: 'legacy-income', label: 'Salary', amount: 1000 }] },
  txnsByMonth: { '2026-07': [{ id: 'legacy-expense', type: 'expense', amount: 100, category: 'other', date: '2026-07-01', desc: 'Legacy expense', expenseClass: 'spending' }] },
}, new Date(2026, 6, 1));
assert.equal(legacy.version, CURRENT_STATE_VERSION);
assert.equal(legacy.savingsAccounts[0].balance, 1234.56);
assert.equal(legacy.incomeByMonth['2026-07'][0].receivedBy, 'unassigned');
assert.equal(legacy.incomeByMonth['2026-07'][0].needsConfirmation, true);
assert.equal(legacy.txnsByMonth['2026-07'][0].expenseClass, 'variable');
assert.equal(legacy.txnsByMonth['2026-07'][0].paid, true);
assert.equal(legacy.txnsByMonth['2026-07'][0].paidBy, 'unassigned');

const backup = createBackupText(state, new Date('2026-07-20T12:00:00Z'));
const restored = parseBackupText(backup, new Date(2026, 6, 20));
assert.equal(restored.version, CURRENT_STATE_VERSION);
assert.equal(monthSummary(restored, '2026-07').projectedEndSavings, 13800);

const annual = annualSummary(state, 2026);
assert.equal(annual.income, 4000);
assert.equal(annual.expenses, 2000);
assert.equal(annual.savedThisMonth, 2000);

assert.equal(normaliseTransaction({ type: 'expense', amount: 0, date: '2026-07-01' }), null);
assert.equal(normaliseIncomeRecord({ amount: 100, description: '', date: '2026-07-01' }, '2026-07'), null);

console.log('Penny finance, migration, transfer-plan and storage tests passed');
