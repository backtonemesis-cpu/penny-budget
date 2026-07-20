import assert from 'node:assert/strict';
import { currentLocalPeriod, currentPeriodCheckDelay } from '../src/current-period.js';
import {
  annualSummary,
  createBlankState,
  dueStatus,
  formatMoney,
  migrateState,
  mkKey,
  monthSummary,
  normaliseTransaction,
  previousMonthKey,
} from '../src/finance.js';
import { appReducer } from '../src/state.js';
import {
  clearPennyState,
  createBackupText,
  loadState,
  parseBackupText,
  saveState,
} from '../src/storage.js';

const now = new Date(2026, 6, 20, 12, 0, 0);

assert.deepEqual(currentLocalPeriod(now), { year: 2026, month: 6, key: '2026-07' });
assert.equal(currentPeriodCheckDelay(new Date(2026, 0, 1), 60 * 60 * 1000), 60 * 60 * 1000);
assert.equal(currentPeriodCheckDelay(new Date(2026, 11, 31, 23, 59, 59, 500)), 1500);
assert.equal(previousMonthKey('2026-01'), '2025-12');
assert.equal(previousMonthKey('bad'), null);

const blank = createBlankState();
assert.equal(blank.version, 3);
assert.deepEqual(blank.txnsByMonth, {});
assert.deepEqual(blank.incomeByMonth, {});
assert.deepEqual(blank.budgetsByMonth, {});
assert.equal(blank.savingsGoal, 0);

const migrated = migrateState({
  version: 2,
  sources: [{ id: 'salary', label: 'Salary', amount: 3000 }],
  txnsByMonth: {
    '2026-06': [
      { id: 'rent', type: 'expense', amount: 1000, date: '2026-06-01', category: 'rent' },
      { id: 'dated-july', type: 'expense', amount: 25, date: '2026-07-02', category: 'other' },
      { id: 'negative', type: 'expense', amount: -50, date: '2026-06-03', category: 'other' },
      { id: 'bad-date', type: 'expense', amount: 50, date: 'not-a-date', category: 'other' },
    ],
    invalid: [{ amount: 99 }],
  },
  budgets: { rent: 1000, groceries: 500, invalid: -20 },
  dueDays: { rent: 1, bad: 99 },
}, now);
assert.equal(migrated.version, 3);
assert.equal(migrated.incomeByMonth['2026-06'][0].amount, 3000);
assert.equal(migrated.incomeByMonth['2026-07'][0].amount, 3000);
assert.equal(migrated.txnsByMonth['2026-06'][0].expenseClass, 'fixed');
assert.equal(migrated.txnsByMonth['2026-07'][0].id, 'dated-july');
assert.equal(migrated.txnsByMonth['2026-06'].length, 1);
assert.equal(migrated.budgetsByMonth['2026-07'].rent, 1000);
assert.equal(migrated.budgetsByMonth['2026-07'].invalid, undefined);
assert.equal(migrated.dueDays.rent, 1);
assert.equal(migrated.dueDays.bad, undefined);
assert.equal(migrated.txnsByMonth.invalid, undefined);
assert.equal(normaliseTransaction({ type: 'expense', amount: -1, date: '2026-07-01', category: 'other' }), null);
assert.equal(normaliseTransaction({ type: 'unknown', amount: 1, date: '2026-07-01', category: 'other' }), null);
assert.equal(normaliseTransaction({ type: 'expense', amount: 1, date: 'invalid', category: 'other' }), null);

const customBillState = migrateState({
  version: 2,
  customCats: [{ id: 'custom_bill', label: 'Custom bill', icon: '🧾', bill: true }],
  txnsByMonth: {
    '2026-07': [{ id: 'custom-payment', type: 'expense', amount: 75, date: '2026-07-10', category: 'custom_bill' }],
  },
}, now);
assert.equal(customBillState.txnsByMonth['2026-07'][0].expenseClass, 'fixed');
assert.equal(monthSummary(customBillState, '2026-07').fixedBills, 75);

const transactions = [
  normaliseTransaction({ id: 'fixed', type: 'expense', amount: 1000, date: '2026-07-01', category: 'rent' }),
  normaliseTransaction({ id: 'spend', type: 'expense', amount: 200, date: '2026-07-02', category: 'groceries' }),
  normaliseTransaction({ id: 'refund', type: 'refund', amount: 50, date: '2026-07-03', category: 'groceries' }),
  normaliseTransaction({ id: 'internal', type: 'internal_transfer', amount: 500, date: '2026-07-04', desc: 'Family account transfer' }),
  normaliseTransaction({ id: 'saving', type: 'savings_transfer', amount: 400, date: '2026-07-05', desc: 'Savings' }),
  normaliseTransaction({ id: 'card', type: 'card_repayment', amount: 300, date: '2026-07-06', desc: 'Card payment' }),
];

const state = {
  ...blank,
  incomeByMonth: { '2026-07': [{ id: 'salary', label: 'Salary', amount: 3000 }] },
  txnsByMonth: { '2026-07': transactions },
};
const july = monthSummary(state, '2026-07');
assert.equal(july.income, 3000);
assert.equal(july.fixedBills, 1000);
assert.equal(july.grossSpending, 200);
assert.equal(july.refunds, 50);
assert.equal(july.internalTransfers, 500);
assert.equal(july.savingsTransfers, 400);
assert.equal(july.cardRepayments, 300);
assert.equal(july.excludedTransfers, 1200);
assert.equal(july.available, 1850);

const annual = annualSummary(state, 2026);
assert.equal(annual.income, 3000);
assert.equal(annual.fixedBills, 1000);
assert.equal(annual.grossSpending, 200);
assert.equal(annual.refunds, 50);
assert.equal(annual.available, 1850);
assert.equal(annual.withData.length, 1);

assert.equal(formatMoney(-500), '-£500.00');
assert.equal(formatMoney(50, { plus: true }), '+£50.00');
assert.deepEqual(dueStatus(2026, 6, '', false, now), { label: 'Set due date', tone: 'neutral' });
assert.equal(dueStatus(2026, 6, 20, false, now).label, 'Due today');
assert.deepEqual(dueStatus(2026, 5, 10, false, now, true), { label: 'Part paid · overdue', tone: 'red' });
assert.equal(mkKey(2027, 0), '2027-01');

let reduced = appReducer(blank, { type: 'SET_BUDGET', monthKey: '2026-07', id: 'rent', value: 1000 });
reduced = appReducer(reduced, { type: 'SET_BUDGET', monthKey: '2026-08', id: 'rent', value: 1100 });
assert.equal(reduced.budgetsByMonth['2026-07'].rent, 1000);
assert.equal(reduced.budgetsByMonth['2026-08'].rent, 1100);
reduced = appReducer(reduced, { type: 'SET_BUDGET', monthKey: '2026-07', id: 'rent', value: 0 });
assert.equal(reduced.budgetsByMonth['2026-07'], undefined);
reduced = appReducer(reduced, { type: 'COPY_BUDGETS', fromMonthKey: '2026-08', toMonthKey: '2026-09' });
assert.equal(reduced.budgetsByMonth['2026-09'].rent, 1100);

const memory = new Map();
const storage = {
  getItem: (key) => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};
assert.equal(saveState(storage, state).ok, true);
assert.equal(loadState(storage, now).state.txnsByMonth['2026-07'].length, 6);
const backup = createBackupText(state, now);
assert.equal(parseBackupText(backup, now).incomeByMonth['2026-07'][0].amount, 3000);
assert.throws(() => parseBackupText('{broken', now), /valid JSON/);
assert.throws(() => parseBackupText('{}', now), /recognised Penny state/);
assert.throws(() => parseBackupText(JSON.stringify({ app: 'Other', state }), now), /different app/);
memory.set('penny_state', '{}');
assert.match(loadState(storage, now).warning, /could not be read/);
assert.match(loadState(null, now).warning, /unavailable/);
assert.equal(saveState(null, state).ok, false);
assert.equal(clearPennyState(null).ok, false);
assert.equal(clearPennyState(storage).ok, true);
assert.equal(storage.getItem('penny_state'), null);

console.log('Penny audit self-tests passed');
