import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankState, migrateState, monthSummary, normaliseTransaction } from '../src/finance.js';
import { validateMoneyInput } from '../src/money-input.js';
import { appReducer } from '../src/state.js';

const signed = validateMoneyInput('-500.25', { allowZero: true, allowNegative: true });
assert.equal(signed.ok, true, 'real balance fields must accept negative values');
assert.equal(signed.value, -500.25);
assert.equal(signed.pence, -50025n);

const ordinaryAmount = validateMoneyInput('-500.25', { allowZero: true });
assert.equal(ordinaryAmount.ok, false, 'ordinary money fields must remain non-negative by default');
assert.equal(ordinaryAmount.code, 'negative');

const monthKey = '2026-08';
let state = createBlankState();
state.people = [{ id: 'person_marius', label: 'Marius' }];
state.accounts = [{ id: 'account_main', label: 'Main', ownerId: 'person_marius' }];

state = appReducer(state, {
  type: 'SET_SAVINGS_ACCOUNTS',
  monthKey,
  items: [{ id: 'saving_test', label: 'Savings test', balance: -125.5 }],
  audit: false,
});
assert.equal(state.savingsByMonth[monthKey][0].balance, -125.5, 'Savings snapshot reducer must preserve a negative real balance');

state = appReducer(state, {
  type: 'SET_BANK_BALANCES',
  monthKey,
  items: [{ id: 'account_main', label: 'Main', balance: -500, ownerId: 'person_marius', ownerLabel: 'Marius' }],
  audit: false,
});
assert.equal(state.bankBalancesByMonth[monthKey][0].balance, -500, 'Transfer Plan bank balance reducer must preserve overdrafts');

const expense = normaliseTransaction({
  id: 'expense_test',
  type: 'expense',
  amount: 1000,
  category: 'rent_mortgage',
  date: '2026-08-01',
  desc: 'Test fixed bill',
  expenseClass: 'fixed',
  paid: false,
  paidBy: 'person_marius',
  account: 'account_main',
  paidByLabel: 'Marius',
  accountLabel: 'Main',
  accountOwnerId: 'person_marius',
  accountOwnerLabel: 'Marius',
  confirmationIssues: [],
  dateConfirmed: true,
  needsConfirmation: false,
  source: 'manual',
});
assert.ok(expense);
state.txnsByMonth = { ...state.txnsByMonth, [monthKey]: [expense] };

const summary = monthSummary(state, monthKey);
const funding = summary.accountFundingPlan.find((row) => row.account === 'account_main');
assert.ok(funding, 'Transfer Plan must include the bill-paying account');
assert.equal(funding.currentBalance, -500, 'Transfer Plan must use the negative current balance');
assert.equal(funding.transferNeeded, 1500, '£1,000 costs with a -£500 bank balance must require a £1,500 transfer');
assert.equal(summary.currentSavings, -125.5, 'Savings total must include a negative savings-account balance when that is the recorded reality');

const migrated = migrateState({
  ...createBlankState(),
  people: state.people,
  accounts: state.accounts,
  savingsByMonth: { [monthKey]: [{ id: 'saving_test', label: 'Savings test', balance: -250.75 }] },
  bankBalancesByMonth: { [monthKey]: [{ id: 'account_main', label: 'Main', balance: -600.25, ownerId: 'person_marius', ownerLabel: 'Marius' }] },
}, new Date('2026-08-15T12:00:00Z'));
assert.equal(migrated.savingsByMonth[monthKey][0].balance, -250.75, 'Reload/migration must not clamp negative savings balances to zero');
assert.equal(migrated.bankBalancesByMonth[monthKey][0].balance, -600.25, 'Reload/migration must not clamp negative bank balances to zero');

const app = await readFile('src/App.jsx', 'utf8');
assert.match(app, /Current bank balance'[\s\S]*allowNegative: true/, 'Transfer Plan balance editor must explicitly allow negative balances');
assert.match(app, /balanceText \? validateMoneyInput\(balanceText, \{ allowZero: true, allowNegative: true \}\)/, 'Savings balance editor must explicitly allow negative balances');
assert.match(app, /function NumberField[\s\S]*validateMoneyInput\(text, \{ allowZero: true \}\)/, 'Savings Goal and Monthly Contribution must remain non-negative');

console.log('v90 signed balance regression passed');
