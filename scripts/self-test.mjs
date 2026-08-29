import assert from 'node:assert/strict';
import { appReducer } from '../src/state.js';
import {
  CURRENT_STATE_VERSION,
  annualSummary,
  createBlankState,
  isLikelyDuplicateIncome,
  isLikelyDuplicateTransaction,
  migrateState,
  monthSummary,
  normaliseIncomeRecord,
  normaliseTransaction,
  roundMoney,
  sumMoney,
} from '../src/finance.js';
import {
  createBackupText,
  loadRollbackState,
  loadState,
  mergeImportedMonths,
  parseBackupPackage,
  parseBackupText,
  saveRollbackState,
} from '../src/storage.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

assert.equal(roundMoney(0.1 + 0.2), 0.3, 'Money must round to pennies.');
assert.equal(sumMoney([0.1, 0.2, 0.3]), 0.6, 'Money totals must not drift in binary floating point.');

const state = {
  ...createBlankState(),
  people: [{ id: 'p1', label: 'Person 1' }, { id: 'p2', label: 'Person 2' }],
  accounts: [{ id: 'a1', label: 'Account 1', ownerId: 'p1' }, { id: 'a2', label: 'Account 2', ownerId: 'p2' }],
  savingsByMonth: {
    '2026-06': [
      { id: 's1', label: 'Savings 1', balance: 6000 },
      { id: 's2', label: 'Savings 2', balance: 4000 },
    ],
    '2026-07': [
      { id: 's1', label: 'Savings 1', balance: 6000 },
      { id: 's2', label: 'Savings 2', balance: 4000 },
    ],
  },
  monthMetaByMonth: {
    '2026-06': { status: 'complete', startingSavings: 8000 },
  },
  incomeByMonth: {
    '2026-06': [
      normaliseIncomeRecord({ id: 'j1', date: '2026-06-01', amount: 2500, description: 'June income', incomeType: 'Employment', receivedBy: 'p1', receivedByLabel: 'Person 1', account: 'a1', accountLabel: 'Account 1', confirmationIssues: [] }, '2026-06'),
    ],
    '2026-07': [
      normaliseIncomeRecord({ id: 'i1', date: '2026-07-01', amount: 3000, description: 'Employment', incomeType: 'Employment', receivedBy: 'p1', receivedByLabel: 'Person 1', account: 'a1', accountLabel: 'Account 1', confirmationIssues: [] }, '2026-07'),
      normaliseIncomeRecord({ id: 'i2', date: '2026-07-05', amount: 1000, description: 'Benefits', incomeType: 'Benefits', receivedBy: 'p2', receivedByLabel: 'Person 2', account: 'a2', accountLabel: 'Account 2', confirmationIssues: [] }, '2026-07'),
    ],
  },
  txnsByMonth: {
    '2026-06': [
      normaliseTransaction({ id: 'je1', type: 'expense', date: '2026-06-01', amount: 500, desc: 'June cost', category: 'other', expenseClass: 'variable', paid: true, paidBy: 'p1', paidByLabel: 'Person 1', account: 'a1', accountLabel: 'Account 1', confirmationIssues: [] }),
    ],
    '2026-07': [
      normaliseTransaction({ id: 'e1', type: 'expense', date: '2026-07-02', amount: 1200, desc: 'Housing', category: 'rent_mortgage', expenseClass: 'fixed', paid: true, paidBy: 'p1', paidByLabel: 'Person 1', account: 'a1', accountLabel: 'Account 1', confirmationIssues: [] }),
      normaliseTransaction({ id: 'e2', type: 'expense', date: '2026-07-10', amount: 200, desc: 'Council tax', category: 'council_tax', expenseClass: 'fixed', paid: false, paidBy: 'p2', paidByLabel: 'Person 2', account: 'a2', accountLabel: 'Account 2', confirmationIssues: [] }),
      normaliseTransaction({ id: 'e3', type: 'expense', date: '2026-07-12', amount: 600, desc: 'Shopping', category: 'variable_household', expenseClass: 'variable', paid: true, paidBy: 'household', paidByLabel: 'Joint', account: 'a1', accountLabel: 'Account 1', confirmationIssues: [] }),
      normaliseTransaction({ id: 'm1', type: 'card_repayment', date: '2026-07-20', amount: 300, desc: 'Card repayment', category: 'card_repayment', account: 'a1', accountLabel: 'Account 1', confirmationIssues: [] }),
    ],
  },
};

const june = monthSummary(state, '2026-06');
assert.equal(june.isComplete, true);
assert.equal(june.startingSavings, 8000);
assert.equal(june.currentSavings, 10000);
assert.equal(june.income, 2500);
assert.equal(june.expenses, 500);
assert.equal(june.savedThisMonth, 2000);
assert.equal(june.expectedClosingSavings, 10000);
assert.equal(june.closingVariance, 0);
assert.equal(june.projectedIncrease, 0, 'Completed months must not have a forward projection increase.');
assert.equal(june.projectedEndSavings, 10000, 'Completed months must never add the monthly saving to an already-recorded closing balance.');
assert.equal(june.auditReady, true);
assert.equal(june.evidenceStatus, 'ready');

const july = monthSummary(state, '2026-07');
assert.equal(july.isComplete, false);
assert.equal(july.currentSavings, 10000);
assert.equal(july.income, 4000);
assert.equal(july.expenses, 2000);
assert.equal(july.paidExpenses, 1800);
assert.equal(july.remainingBills, 200);
assert.equal(july.fixedExpenses, 1400);
assert.equal(july.variableExpenses, 600);
assert.equal(july.savedThisMonth, 2000);
assert.equal(july.freeSavingsAfterBills, 9800);
assert.equal(july.projectedIncrease, 2000);
assert.equal(july.projectedEndSavings, 12000);
assert.equal(july.excludedMovements, 300);
assert.deepEqual(july.transferPlan.map(({ key, paidBy, account, amount, count }) => ({ key, paidBy, account, amount, count })), [{ key: 'p2::a2', paidBy: 'p2', account: 'a2', amount: 200, count: 1 }]);
assert.deepEqual(july.accountFundingPlan.map(({ key, account, amount, count }) => ({ key, account, amount, count })), [{ key: 'a2', account: 'a2', amount: 200, count: 1 }]);
assert.equal(july.accountFundingPlan[0].hasCurrentBalance, false, 'Missing bank balances must not be treated as confirmed zero evidence.');
assert.equal(july.accountFundingPlan[0].ownerId, 'p2', 'Transfer rows must identify the bank-account owner.');
assert.equal(july.hasUnconfirmedAccountOwners, false);
assert.equal(july.hasUnconfirmedBankBalances, true);
assert.equal(july.incompleteRecords, 0);
assert.equal(july.auditReady, false, 'A live or in-progress month must never be labelled final audit evidence.');
assert.equal(july.evidenceStatus, 'in_progress');

const fundingPlanState = {
  ...createBlankState(),
  people: [{ id: 'p1', label: 'Person 1' }, { id: 'p2', label: 'Person 2' }],
  accounts: [{ id: 'a1', label: 'Account 1', ownerId: 'p1' }],
  bankBalancesByMonth: {
    '2026-10': [{ id: 'a1', label: 'Account 1', balance: 60, ownerId: 'p1', ownerLabel: 'Person 1' }],
  },
  txnsByMonth: {
    '2026-10': [
      normaliseTransaction({ id: 'fund-1', type: 'expense', date: '2026-10-01', amount: 100, desc: 'Bill one', category: 'other', expenseClass: 'fixed', paid: false, paidBy: 'p1', paidByLabel: 'Person 1', account: 'a1', accountLabel: 'Account 1', confirmationIssues: [] }),
      normaliseTransaction({ id: 'fund-2', type: 'expense', date: '2026-10-02', amount: 50, desc: 'Bill two', category: 'other', expenseClass: 'fixed', paid: false, paidBy: 'p2', paidByLabel: 'Person 2', account: 'a1', accountLabel: 'Account 1', confirmationIssues: [] }),
      normaliseTransaction({ id: 'fund-3', type: 'expense', date: '2026-10-03', amount: 40, desc: 'Already covered', category: 'other', expenseClass: 'fixed', paid: true, paidBy: 'p1', paidByLabel: 'Person 1', account: 'a1', accountLabel: 'Account 1', confirmationIssues: [] }),
    ],
  },
};
const fundingPlan = monthSummary(fundingPlanState, '2026-10').accountFundingPlan;
assert.deepEqual(fundingPlan.map(({ key, account, amount, currentBalance, transferNeeded, count }) => ({ key, account, amount, currentBalance, transferNeeded, count })), [{ key: 'a1', account: 'a1', amount: 150, currentBalance: 60, transferNeeded: 90, count: 2 }], 'Start-of-month transfer planning must group unpaid expenses by bank account and subtract confirmed bank balances.');
assert.equal(monthSummary(fundingPlanState, '2026-10').totalTransferNeeded, 90);
assert.equal(monthSummary(fundingPlanState, '2026-10').hasUnconfirmedBankBalances, false);
assert.equal(fundingPlan[0].ownerId, 'p1');
assert.equal(monthSummary(fundingPlanState, '2026-10').hasUnconfirmedAccountOwners, false);
assert.deepEqual(fundingPlan[0].payers.map(({ paidBy, amount, count }) => ({ paidBy, amount, count })), [
  { paidBy: 'p1', amount: 100, count: 1 },
  { paidBy: 'p2', amount: 50, count: 1 },
], 'Account transfer rows must preserve the payer breakdown for audit visibility.');

const toggled = appReducer(state, { type: 'TOGGLE_PAID', monthKey: '2026-07', id: 'e2', auditAt: '2026-07-20T12:00:00.000Z', auditId: 'audit-toggle' });
assert.equal(monthSummary(toggled, '2026-07').remainingBills, 0);
assert.equal(monthSummary(toggled, '2026-07').projectedEndSavings, 12000, 'Payment status must not change net monthly saving.');
assert.equal(toggled.auditLog[0].action, 'mark_paid');
assert.equal(toggled.auditLog[0].before.paid, false);
assert.equal(toggled.auditLog[0].after.paid, true);

const changedJuneSavings = appReducer(state, {
  type: 'SET_SAVINGS_ACCOUNTS',
  monthKey: '2026-06',
  items: [{ id: 's1', label: 'Savings 1', balance: 9000 }],
  auditAt: '2026-07-20T12:00:00.000Z',
  auditId: 'audit-savings',
});
assert.equal(monthSummary(changedJuneSavings, '2026-06').currentSavings, 9000);
assert.equal(monthSummary(changedJuneSavings, '2026-06').closingVariance, -1000);
assert.equal(monthSummary(changedJuneSavings, '2026-07').currentSavings, 10000, 'Editing June savings must not change July.');
assert.equal(changedJuneSavings.auditLog[0].entityType, 'savings_snapshot');

const changedBankBalance = appReducer(fundingPlanState, {
  type: 'SET_BANK_BALANCES',
  monthKey: '2026-10',
  items: [{ id: 'a1', label: 'Account 1', balance: 72.345, ownerId: 'p1', ownerLabel: 'Person 1' }],
  auditAt: '2026-10-01T12:00:00.000Z',
  auditId: 'audit-bank-balance',
});
assert.equal(changedBankBalance.bankBalancesByMonth['2026-10'][0].balance, 72.35, 'Bill-paying bank balances must be normalised to pennies.');
assert.equal(changedBankBalance.bankBalancesByMonth['2026-10'][0].ownerId, 'p1', 'Bank-balance snapshots must preserve account ownership.');
assert.equal(monthSummary(changedBankBalance, '2026-10').accountFundingPlan[0].transferNeeded, 77.65);
assert.equal(changedBankBalance.auditLog[0].entityType, 'bank_balance_snapshot');

const ownerMigration = migrateState({
  version: 8,
  people: [{ id: 'p1', label: 'Person 1' }],
  accounts: [
    { id: 'owned', label: 'Owned Account', ownerId: 'p1' },
    { id: 'legacy-account', label: 'Legacy Account' },
  ],
}, new Date(2026, 8, 1));
assert.equal(ownerMigration.version, CURRENT_STATE_VERSION);
assert.equal(ownerMigration.accounts.find((account) => account.id === 'owned').ownerId, 'p1');
assert.equal(ownerMigration.accounts.find((account) => account.id === 'legacy-account').ownerId, 'unassigned', 'Legacy accounts must migrate to Owner TBC rather than being guessed.');

const ownerSnapshotTxn = normaliseTransaction({
  id: 'owner-snapshot', type: 'expense', date: '2026-09-01', amount: 10, desc: 'Owned bill', category: 'other', paid: false,
  paidBy: 'p1', account: 'a1', accountLabel: 'Account 1', accountOwnerId: 'p1', accountOwnerLabel: 'Person 1', confirmationIssues: [],
});
assert.equal(ownerSnapshotTxn.accountOwnerId, 'p1');
assert.equal(ownerSnapshotTxn.accountOwnerLabel, 'Person 1');

const legacyUncertain = normaliseTransaction({
  id: 'legacy-uncertain', type: 'expense', date: '2026-09-01', amount: 10, desc: 'Imported cost', category: 'other', paid: true, paidBy: 'p1', account: 'a1', needsConfirmation: true,
});
assert.equal(legacyUncertain.needsConfirmation, true);
assert.equal(legacyUncertain.dateConfirmed, false);
assert.equal(legacyUncertain.confirmationIssues.includes('date'), true, 'Legacy needsConfirmation must not be silently cleared.');

const explicitAccountIssue = normaliseTransaction({
  id: 'explicit-account', type: 'expense', date: '2026-09-02', amount: 10, desc: 'Account TBC', category: 'other', paidBy: 'p1', account: 'unassigned', confirmationIssues: ['account'], dateConfirmed: true,
});
assert.equal(explicitAccountIssue.dateConfirmed, true);
assert.equal(explicitAccountIssue.confirmationIssues.includes('date'), false);
assert.equal(explicitAccountIssue.confirmationIssues.includes('account'), true);
assert.equal(explicitAccountIssue.paid, false, 'New expenses without an explicit paid value must default to unpaid.');

const missingIncomeDate = normaliseIncomeRecord({ id: 'income-date-tbc', amount: 100, description: 'Income', incomeType: 'Other', receivedBy: 'p1', account: 'a1' }, '2026-09');
assert.equal(missingIncomeDate.date, '2026-09-01');
assert.equal(missingIncomeDate.confirmationIssues.includes('date'), true);
assert.equal(missingIncomeDate.dateConfirmed, false);

const labelledMigration = migrateState({
  version: 6,
  people: [{ id: 'p1', label: 'Historic Person' }],
  accounts: [{ id: 'a1', label: 'Historic Account' }],
  txnsByMonth: { '2026-07': [{ id: 'label-txn', type: 'expense', date: '2026-07-01', amount: 20, desc: 'Label test', category: 'other', paid: true, paidBy: 'p1', account: 'a1', confirmationIssues: [] }] },
}, new Date(2026, 6, 1));
assert.equal(labelledMigration.txnsByMonth['2026-07'][0].paidByLabel, 'Historic Person');
assert.equal(labelledMigration.txnsByMonth['2026-07'][0].accountLabel, 'Historic Account');
const renamedReferences = appReducer(labelledMigration, { type: 'SET_REFERENCE_LIST', field: 'people', items: [{ id: 'p1', label: 'New Person Name' }], auditAt: '2026-07-20T12:00:00.000Z', auditId: 'audit-rename' });
assert.equal(renamedReferences.txnsByMonth['2026-07'][0].paidByLabel, 'Historic Person', 'Historical record labels must not change when a master reference is renamed.');
assert.equal(renamedReferences.people[0].label, 'New Person Name');
assert.equal(renamedReferences.auditLog[0].entityType, 'people');

const duplicateExpense = normaliseTransaction({ id: 'dup-2', type: 'expense', date: '2026-07-02', amount: 1200, desc: 'Housing', category: 'rent_mortgage', expenseClass: 'fixed', paid: false, paidBy: 'p1', account: 'a1', confirmationIssues: [] });
assert.equal(isLikelyDuplicateTransaction(state.txnsByMonth['2026-07'][0], duplicateExpense), true);
const duplicateIncome = normaliseIncomeRecord({ id: 'dup-i', date: '2026-07-01', amount: 3000, description: 'Employment', incomeType: 'Employment', receivedBy: 'p1', account: 'a1', confirmationIssues: [] }, '2026-07');
assert.equal(isLikelyDuplicateIncome(state.incomeByMonth['2026-07'][0], duplicateIncome), true);

const addForAudit = appReducer(createBlankState(), {
  type: 'ADD_TXN',
  monthKey: '2026-08',
  txn: normaliseTransaction({ id: 'audit-expense', type: 'expense', date: '2026-08-01', amount: 25, desc: 'Audit expense', category: 'other', paid: false, paidBy: 'household', account: 'unassigned', confirmationIssues: ['account'] }),
  auditAt: '2026-08-01T12:00:00.000Z',
  auditId: 'audit-add',
});
assert.equal(addForAudit.auditLog.length, 1);
assert.equal(addForAudit.auditLog[0].after.amount, 25);
const deleteForAudit = appReducer(addForAudit, { type: 'DELETE_TXN', monthKey: '2026-08', id: 'audit-expense', auditAt: '2026-08-02T12:00:00.000Z', auditId: 'audit-delete' });
assert.equal(deleteForAudit.auditLog[0].action, 'delete');
assert.equal(deleteForAudit.auditLog[0].before.amount, 25, 'Deleted records must retain their before-state in Change History.');

const annualState = {
  ...state,
  txnsByMonth: {
    ...state.txnsByMonth,
    '2026-08': [normaliseTransaction({ id: 'unconfirmed', type: 'expense', date: '2026-08-01', amount: 10, desc: 'Date TBC', category: 'other', paid: true, paidBy: 'p1', account: 'a1', confirmationIssues: ['date'] })],
  },
};
const annual = annualSummary(annualState, 2026);
assert.equal(annual.auditReady, false);
assert.equal(annual.evidenceStatus, 'in_progress');
assert.equal(annual.incompleteRecords, 1);
assert.equal(annual.monthsInProgress >= 2, true, 'Live months with records must be counted as in progress, not final evidence.');
assert.equal(annual.monthsNeedingReview, 0, 'A clean completed month is ready; live months are tracked separately as in progress.');
assert.equal(annual.withData.some((item) => item.key === '2026-06'), true, 'Savings or completed-month data must count as annual data.');

const legacy = migrateState({
  version: 4,
  savingsAccounts: [{ id: 'legacy', label: 'Savings', balance: 1234.56 }],
  incomeByMonth: { '2026-07': [{ id: 'legacy-income', label: 'Salary', amount: 1000 }] },
  txnsByMonth: { '2026-07': [{ id: 'legacy-expense', type: 'expense', amount: 100, category: 'other', date: '2026-07-01', desc: 'Legacy expense', expenseClass: 'spending' }] },
}, new Date(2026, 7, 1));
assert.equal(legacy.version, CURRENT_STATE_VERSION);
assert.equal(legacy.savingsByMonth['2026-07'][0].balance, 1234.56);
assert.equal(legacy.savingsByMonth['2026-08'], undefined);
assert.equal(legacy.incomeByMonth['2026-07'][0].receivedBy, 'unassigned');
assert.equal(legacy.incomeByMonth['2026-07'][0].needsConfirmation, true);
assert.equal(legacy.txnsByMonth['2026-07'][0].expenseClass, 'variable');
assert.equal(legacy.txnsByMonth['2026-07'][0].paid, false, 'Legacy rows without explicit payment status must not be assumed paid.');

const backup = createBackupText(state, new Date('2026-07-20T12:00:00Z'));
const restored = parseBackupText(backup, new Date(2026, 6, 20));
assert.equal(restored.version, CURRENT_STATE_VERSION);
assert.equal(monthSummary(restored, '2026-06').projectedEndSavings, 10000);
assert.equal(monthSummary(restored, '2026-07').projectedEndSavings, 12000);

assert.throws(
  () => parseBackupPackage(JSON.stringify({ app: 'Penny', formatVersion: CURRENT_STATE_VERSION + 1, state })),
  /newer Penny data format/,
  'Backups from a future schema must be rejected instead of silently down-migrated.',
);

const corruptedStorage = memoryStorage({ penny_state: '{not-valid-json' });
const corruptedLoad = loadState(corruptedStorage, new Date(2026, 7, 1));
assert.equal(corruptedLoad.recoveryRequired, true);
assert.match(corruptedLoad.warning, /Editing is locked/);

const rollbackStorage = memoryStorage();
assert.equal(saveRollbackState(rollbackStorage, state).ok, true);
const rollbackState = loadRollbackState(rollbackStorage, new Date(2026, 6, 20));
assert.equal(monthSummary(rollbackState, '2026-07').income, 4000);

const juneImportState = {
  ...createBlankState(),
  people: [{ id: 'p3', label: 'Person 3' }],
  accounts: [{ id: 'a3', label: 'Account 3' }],
  savingsByMonth: { '2026-06': [{ id: 'sx', label: 'Historical Savings', balance: 8500 }] },
  monthMetaByMonth: { '2026-06': { status: 'complete', startingSavings: 6500 } },
  incomeByMonth: {
    '2026-06': [normaliseIncomeRecord({ id: 'june-income', date: '2026-06-01', amount: 2500, description: 'June income', incomeType: 'Employment', receivedBy: 'p3', account: 'a3', confirmationIssues: [] }, '2026-06')],
  },
  txnsByMonth: {
    '2026-06': [normaliseTransaction({ id: 'june-expense', type: 'expense', date: '2026-06-01', amount: 500, desc: 'June cost', category: 'other', expenseClass: 'variable', paid: true, paidBy: 'p3', account: 'a3', confirmationIssues: [] })],
  },
};
const mergeText = JSON.stringify({ app: 'Penny', formatVersion: CURRENT_STATE_VERSION, importMode: 'merge_months', mergeMonths: ['2026-06'], state: juneImportState });
const mergePackage = parseBackupPackage(mergeText, new Date(2026, 7, 1));
assert.equal(mergePackage.importMode, 'merge_months');
const merged = mergeImportedMonths(state, mergePackage.state, mergePackage.mergeMonths, new Date(2026, 7, 1));
const mergedJune = monthSummary(merged, '2026-06');
assert.equal(mergedJune.currentSavings, 8500);
assert.equal(mergedJune.expectedClosingSavings, 8500);
assert.equal(mergedJune.closingVariance, 0);
assert.equal(mergedJune.projectedEndSavings, 8500, 'Completed merged month must show the recorded closing balance, not add saving again.');
assert.equal(monthSummary(merged, '2026-07').currentSavings, 10000, 'June merge must preserve July savings.');
assert.equal(merged.bankBalancesByMonth['2026-10']?.[0]?.balance, undefined, 'Month merge must not introduce unrelated bank-balance months.');
assert.equal(monthSummary(merged, '2026-07').income, 4000, 'June merge must preserve July records.');
assert.equal(merged.txnsByMonth['2026-06'][0].source, 'import');
assert.equal(merged.people.some((person) => person.id === 'p3'), true);
assert.equal(merged.accounts.some((account) => account.id === 'a3'), true);

assert.equal(normaliseTransaction({ type: 'expense', amount: 0, date: '2026-07-01' }), null);
assert.equal(normaliseIncomeRecord({ amount: 100, description: '', date: '2026-07-01' }, '2026-07'), null);

console.log('Penny accounting, provenance, audit-trail, duplicate, recovery and completed-evidence regression tests passed');
