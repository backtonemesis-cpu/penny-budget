import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');

assert.match(app, /PENNY_V43_CLEAN_MONEY_TABS/, 'v43 cleanup marker must be present.');
assert.doesNotMatch(app, /aria-label="Transaction filters"/, 'Income and Expenses must not render the old search/filter panel.');
assert.doesNotMatch(app, /id="transaction-search"/, 'Transactions search must be removed from the visible money-flow tabs.');
assert.doesNotMatch(app, /id="paid-filter"/, 'Expense payment-status filter must be removed.');
assert.doesNotMatch(app, /id="expense-class-filter"/, 'Expense type filter must be removed.');
assert.doesNotMatch(app, />\+ Add Account<\/button>/, 'Savings must not have its own Add Account button.');
assert.doesNotMatch(app, /id="savings-account-select"/, 'Savings must not duplicate account selection outside Settings.');
assert.match(app, /displayedSavingsAccounts/, 'Savings must display accounts maintained in Settings.');
assert.match(app, /field="savingsAccounts"/, 'Savings account creation must remain available in Settings.');
assert.match(app, /const updateAccount = \(id, patch\) => \{/, 'Savings balance editing must upsert a monthly snapshot for a Settings account.');
assert.match(app, />Income<\/button>[\s\S]*>Expenses<\/button>[\s\S]*>Savings<\/button>/, 'Money-flow tab order must remain Income, Expenses, Savings.');

console.log('Clean Income / Expenses / Savings tabs regression passed.');
