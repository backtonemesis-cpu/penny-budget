import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankState, monthSummary, normaliseIncomeRecord, normaliseTransaction } from '../src/finance.js';

const monthKey = '2026-08';
const state = createBlankState();
state.savingsByMonth = {
  [monthKey]: [{ id: 'saving_test', label: 'Santander', balance: -10000 }],
};
state.incomeByMonth = {
  [monthKey]: [normaliseIncomeRecord({
    id: 'income_test',
    date: '2026-08-01',
    amount: 6177.08,
    description: 'Test income',
    incomeType: 'Salary',
    receivedBy: 'unassigned',
    account: 'unassigned',
    confirmationIssues: ['receivedBy', 'account'],
  }, monthKey)],
};
state.txnsByMonth = {
  [monthKey]: [normaliseTransaction({
    id: 'expense_test',
    type: 'expense',
    amount: 2694.63,
    category: 'other',
    date: '2026-08-01',
    desc: 'Test expenses',
    expenseClass: 'variable',
    paid: true,
    paidBy: 'unassigned',
    account: 'unassigned',
    confirmationIssues: ['paidBy', 'account'],
  })],
};

const summary = monthSummary(state, monthKey);
assert.equal(summary.income, 6177.08);
assert.equal(summary.expenses, 2694.63);
assert.equal(summary.savedThisMonth, 3482.45, 'monthly savings must remain income minus expenses');
assert.equal(summary.currentSavings, -10000, 'recorded negative savings snapshot must remain part of the month total');
assert.equal(summary.projectedEndSavings, -6517.55, 'Total savings must include the negative snapshot plus the month net saving');

const app = await readFile('src/App.jsx', 'utf8');
assert.match(app, /account\.balance < 0 \? 'red' : 'green'/, 'negative savings-account balances must render red');
assert.match(app, /summary\.currentSavings < 0 \? 'red' : 'green'/, 'negative savings snapshot total must render red');

const overviewFlow = await readFile('src/overview-four-card-flow.js', 'utf8');
assert.match(overviewFlow, /syncValueTone\(totalCard, heroCards\[1\]\)/, 'Overview Total savings must keep its colour in sync when the projected total changes sign');

console.log('v91 negative savings overview regression passed');
