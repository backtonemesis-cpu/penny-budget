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
import {
  createBackupText,
  mergeImportedMonths,
  parseBackupPackage,
  parseBackupText,
} from '../src/storage.js';

const state = {
  ...createBlankState(),
  people: [{ id: 'p1', label: 'Person 1' }, { id: 'p2', label: 'Person 2' }],
  accounts: [{ id: 'a1', label: 'Account 1' }, { id: 'a2', label: 'Account 2' }],
  savingsByMonth: {
    '2026-06': [
      { id: 's1', label: 'Savings 1', balance: 5000 },
      { id: 's2', label: 'Savings 2', balance: 3500 },
    ],
    '2026-07': [
      { id: 's1', label: 'Savings 1', balance: 6000 },
      { id: 's2', label: 'Savings 2', balance: 4000 },
    ],
  },
  monthStatusByMonth: { '2026-06': 'closed' },
  openingSavingsByMonth: { '2026-06': 7000 },
  incomeByMonth: {
    '2026-06': [
      normaliseIncomeRecord({ id: 'ji1', date: '2026-06-01', amount: 2000, description: 'Historical income', incomeType: 'Employment', receivedBy: 'p1', account: 'a1' }, '2026-06'),
    ],
    '2026-07': [
      normaliseIncomeRecord({ id: 'i1', date: '2026-07-01', amount: 3000, description: 'Employment', incomeType: 'Employment', receivedBy: 'p1', account: 'a1' }, '2026-07'),
      normaliseIncomeRecord({ id: 'i2', date: '2026-07-05', amount: 1000, description: 'Benefits', incomeType: 'Benefits', receivedBy: 'p2', account: 'a2' }, '2026-07'),
    ],
  },
  txnsByMonth: {
    '2026-06': [
      normaliseTransaction({ id: 'je1', type: 'expense', date: '2026-06-01', amount: 500, desc: 'Historical cost', category: 'other', expenseClass: 'variable', paid: true, paidBy: 'p1', account: 'a1' }),
    ],
    '2026-07': [
      normaliseTransaction({ id: 'e1', type: 'expense', date: '2026-07-02', amount: 1200, desc: 'Housing', category: 'rent_mortgage', expenseClass: 'fixed', paid: true, paidBy: 'p1', account: 'a1' }),
      normaliseTransaction({ id: 'e2', type: 'expense', date: '2026-07-10', amount: 200, desc: 'Council tax', category: 'council_tax', expenseClass: 'fixed', paid: false, paidBy: 'p2', account: 'a2' }),
      normaliseTransaction({ id: 'e3', type: 'expense', date: '2026-07-12', amount: 600, desc: 'Shopping', category: 'variable_household', expenseClass: 'variable', paid: true, paidBy: 'household', account: 'a1' }),
      normaliseTransaction({ id: 'm1', type: 'card_repayment', date: '2026-07-20', amount: 300, desc: 'Card repayment', category: 'card_repayment', account: 'a1' }),
    ],
  },
};

const june = monthSummary(state, '2026-06');
assert.equal(june.monthStatus, 'closed');
assert.equal(june.openingSavings, 7000);
assert.equal(june.currentSavings, 8500);
assert.equal(june.hasSavingsSnapshot, true);
assert.equal(june.income, 2000);
assert.equal(june.expenses, 500);
assert.equal(june.savedThisMonth, 1500);
assert.equal(june.historicalCalculatedEndSavings, 8500);
assert.equal(june.reconciliationDifference, 0);
assert.equal(june.historicalReconciled, true);
assert.equal(june.projectedEndSavings, 8500, 'A closed month must show recorded ending savings, not add income again.');
assert.equal(june.projectedIncrease, 1500);

const july = monthSummary(state, '2026-07');
assert.equal(july.monthStatus, 'live');
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

const changedJuneSavings = appReducer(state, {
  type: 'SET_SAVINGS_ACCOUNTS',
  monthKey: '2026-06',
  items: [{ id: 's1', label: 'Savings 1', balance: 9000 }],
});
assert.equal(monthSummary(changedJuneSavings, '2026-06').currentSavings, 9000);
assert.equal(monthSummary(changedJuneSavings, '2026-07').currentSavings, 10000, 'Editing June savings must not change July.');

const legacy = migrateState({
  version: 4,
  savingsAccounts: [{ id: 'legacy', label: 'Savings', balance: 1234.56 }],
  incomeByMonth: { '2026-07': [{ id: 'legacy-income', label: 'Salary', amount: 1000 }] },
  txnsByMonth: { '2026-07': [{ id: 'legacy-expense', type: 'expense', amount: 100, category: 'other', date: '2026-07-01', desc: 'Legacy expense', expenseClass: 'spending' }] },
}, new Date(2026, 7, 1));
assert.equal(legacy.version, CURRENT_STATE_VERSION);
assert.equal(legacy.savingsByMonth['2026-07'][0].balance, 1234.56, 'Version-4 savings should migrate to the latest month containing data.');
assert.equal(legacy.savingsByMonth['2026-08'], undefined);
assert.equal(legacy.monthStatusByMonth['2026-07'], undefined, 'Legacy data must remain live unless explicitly marked closed.');
assert.equal(legacy.incomeByMonth['2026-07'][0].receivedBy, 'unassigned');
assert.equal(legacy.incomeByMonth['2026-07'][0].needsConfirmation, true);
assert.equal(legacy.txnsByMonth['2026-07'][0].expenseClass, 'variable');
assert.equal(legacy.txnsByMonth['2026-07'][0].paid, true);
assert.equal(legacy.txnsByMonth['2026-07'][0].paidBy, 'unassigned');

const backup = createBackupText(state, new Date('2026-07-20T12:00:00Z'));
const restored = parseBackupText(backup, new Date(2026, 6, 20));
assert.equal(restored.version, CURRENT_STATE_VERSION);
assert.equal(monthSummary(restored, '2026-06').historicalReconciled, true);
assert.equal(monthSummary(restored, '2026-07').projectedEndSavings, 13800);

const juneImportState = {
  ...createBlankState(),
  people: [{ id: 'p3', label: 'Person 3' }],
  accounts: [{ id: 'a3', label: 'Account 3' }],
  savingsByMonth: { '2026-06': [{ id: 'sx', label: 'Historical Savings', balance: 8500 }] },
  monthStatusByMonth: { '2026-06': 'closed' },
  openingSavingsByMonth: { '2026-06': 7000 },
  incomeByMonth: {
    '2026-06': [normaliseIncomeRecord({ id: 'june-income', date: '2026-06-01', amount: 2000, description: 'June income', incomeType: 'Employment', receivedBy: 'p3', account: 'a3' }, '2026-06')],
  },
  txnsByMonth: {
    '2026-06': [normaliseTransaction({ id: 'june-expense', type: 'expense', date: '2026-06-01', amount: 500, desc: 'June cost', category: 'other', expenseClass: 'variable', paid: true, paidBy: 'p3', account: 'a3' })],
  },
};
const mergeText = JSON.stringify({ app: 'Penny', formatVersion: CURRENT_STATE_VERSION, importMode: 'merge_months', mergeMonths: ['2026-06'], state: juneImportState });
const mergePackage = parseBackupPackage(mergeText, new Date(2026, 7, 1));
assert.equal(mergePackage.importMode, 'merge_months');
assert.deepEqual(mergePackage.mergeMonths, ['2026-06']);
const merged = mergeImportedMonths(state, mergePackage.state, mergePackage.mergeMonths, new Date(2026, 7, 1));
assert.equal(monthSummary(merged, '2026-06').currentSavings, 8500);
assert.equal(monthSummary(merged, '2026-06').openingSavings, 7000);
assert.equal(monthSummary(merged, '2026-06').historicalReconciled, true);
assert.equal(monthSummary(merged, '2026-07').currentSavings, 10000, 'June merge must preserve July savings.');
assert.equal(monthSummary(merged, '2026-07').income, 4000, 'June merge must preserve July records.');
assert.equal(merged.people.some((person) => person.id === 'p3'), true);
assert.equal(merged.accounts.some((account) => account.id === 'a3'), true);

const annual = annualSummary(state, 2026);
assert.equal(annual.income, 6000);
assert.equal(annual.expenses, 2500);
assert.equal(annual.savedThisMonth, 3500);
assert.equal(annual.withData.length, 2);

assert.equal(normaliseTransaction({ type: 'expense', amount: 0, date: '2026-07-01' }), null);
assert.equal(normaliseIncomeRecord({ amount: 100, description: '', date: '2026-07-01' }, '2026-07'), null);

console.log('Penny historical reconciliation, month-specific savings, migration, merge-import and finance tests passed');
