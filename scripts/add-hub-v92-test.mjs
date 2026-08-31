import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankState } from '../src/finance.js';
import { appReducer } from '../src/state.js';

const monthKey = '2026-10';
let state = createBlankState();

const person = { id: 'person_test', label: 'Test Person' };
state = appReducer(state, {
  type: 'SET_MONTH_REFERENCE_LIST',
  monthKey,
  field: 'people',
  items: [person],
  audit: false,
});
assert.deepEqual(state.peopleByMonth[monthKey], [person], 'Add person must write to the selected standalone month');

const card = { id: 'account_test_card', label: 'Test Card', ownerId: person.id, accountType: 'credit' };
state = appReducer(state, {
  type: 'SET_MONTH_REFERENCE_LIST',
  monthKey,
  field: 'accounts',
  items: [card],
  audit: false,
});
assert.equal(state.accountsByMonth[monthKey][0].accountType, 'credit', 'Credit-card metadata must survive month-scoped account storage');
assert.equal(state.accountsByMonth[monthKey][0].ownerId, person.id, 'Created account owner must be preserved');

const savings = { id: 'saving_test', label: 'Emergency Fund', balance: 0, ownerId: person.id, accountType: 'savings' };
state = appReducer(state, {
  type: 'SET_SAVINGS_ACCOUNTS',
  monthKey,
  items: [savings],
  audit: false,
});
assert.equal(state.savingsByMonth[monthKey][0].accountType, 'savings', 'Savings account type must survive monthly snapshot storage');
assert.equal(state.savingsByMonth[monthKey][0].ownerId, person.id, 'Savings owner must be preserved');

const app = await readFile('src/App.jsx', 'utf8');
assert.match(app, /PENNY_V92_ADD_HUB/, 'v92 Add hub marker must be present after postinstall');
assert.match(app, /setMode\('account'\)/, '+ Add must include an Account tab');
assert.match(app, /Debit \/ current account[\s\S]*Credit card[\s\S]*Savings account/, 'Account tab must offer debit/current, credit card and savings types');
assert.match(app, /type: 'SET_MONTH_REFERENCE_LIST'[\s\S]*field: 'people'/, 'Inline person creation must be month-scoped');
assert.match(app, /type: 'SET_MONTH_REFERENCE_LIST'[\s\S]*field: 'accounts'/, 'Inline debit/card creation must be month-scoped');
assert.match(app, /type: 'SET_SAVINGS_ACCOUNTS'/, 'Savings creation must use the monthly savings snapshot');
assert.ok((app.match(/\+ Add person/g) || []).length >= 1, 'Shared quick setup must expose Add person');
assert.ok((app.match(/\+ Add account/g) || []).length >= 1, 'Shared quick setup must expose Add account');
assert.ok((app.match(/\{renderQuickSetup\(\)\}/g) || []).length >= 2, 'Income and Expense must both render the shared quick setup controls');
assert.match(app, /Advanced account management in Settings/, 'Settings must remain available as an administrative fallback');

const main = await readFile('src/main.jsx', 'utf8');
assert.match(main, /add-hub-v92\.css/, 'v92 Add hub styles must be loaded');
const css = await readFile('src/add-hub-v92.css', 'utf8');
assert.match(css, /record-tabs[\s\S]*repeat\(3/, 'Mobile Add tabs must fit Expense, Income and Account');

console.log('v92 unified Add hub regression passed');
