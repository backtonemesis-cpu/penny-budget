import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const clear = await readFile(new URL('../src/month-clear.js', import.meta.url), 'utf8');

assert.match(app, /function SettingsModal\(\{ state, monthKey,/, 'Settings must receive the selected month.');
assert.match(app, /function SavingsSettingsEditor\(\{ state, monthKey, mutate \}\)/, 'Savings Settings must be month-scoped.');
assert.match(app, /const items = state\.savingsByMonth\?\.\[monthKey\] \|\| \[\];/, 'Savings Settings must read only the selected month snapshot.');
assert.match(app, /type: 'SET_SAVINGS_ACCOUNTS', monthKey, items: nextItems/, 'Savings Settings edits must write only the selected month.');
assert.doesNotMatch(app, /ReferenceEditor field="savingsAccounts" items=\{state\.savingsAccounts \|\| \[\]\}/, 'Settings must not show the legacy global savings master list.');
assert.match(app, /Add savings accounts for this month in Settings first\./, 'Savings tab must treat account setup as month-specific.');
assert.match(clear, /savingsByMonth: withoutKey\(state\.savingsByMonth, monthKey\)/, 'Reset month must remove the selected month savings accounts and balances.');

console.log('v80 month savings reset regression passed');
