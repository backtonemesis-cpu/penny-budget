import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const monthSetup = await readFile(new URL('../src/month-setup.js', import.meta.url), 'utf8');
const state = await readFile(new URL('../src/state.js', import.meta.url), 'utf8');

assert.match(app, /Start New Month/, 'Overview must expose a Start New Month action.');
assert.match(app, /StartNewMonthModal/, 'Recurring bills must be previewed before copying.');
assert.match(app, /Copied from prior month/, 'Copied recurring bills must remain visibly identifiable after setup.');
assert.match(app, /FundingBalanceEditor/, 'Bank-balance inputs must live in the Overview funding workflow.');
assert.doesNotMatch(app, /enter bank balances in Savings/i, 'Overview must not direct users to another tab for transfer planning.');
assert.doesNotMatch(app, /Bill-Paying Bank Balances —/, 'Savings must no longer duplicate bill-paying bank-balance inputs.');
assert.match(monthSetup, /expenseClass === 'fixed'/, 'Only fixed expenses may be recurring-bill candidates.');
assert.match(monthSetup, /paid: false/, 'Copied bills must start unpaid.');
assert.match(monthSetup, /dateConfirmed: false/, 'Copied dates must remain unconfirmed evidence.');
assert.match(monthSetup, /source: 'month_copy'/, 'Copied bills must be identifiable as month-copy planning records.');
assert.match(state, /case 'COPY_RECURRING_BILLS'/, 'Recurring bill copy must be handled atomically by the reducer.');
assert.match(state, /recurringBillKey/, 'Reducer-level duplicate protection must guard repeated month setup.');

console.log('Penny unified month setup source audit passed');
