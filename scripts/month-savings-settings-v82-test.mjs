import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const clear = await readFile(new URL('../src/month-clear.js', import.meta.url), 'utf8');

assert.match(app, /<SettingsModal[\s\S]{0,300}monthKey=\{monthKey\}/, 'Settings must receive the selected month.');
assert.match(app, /function SettingsModal\(\{ state, monthKey,/, 'SettingsModal must receive monthKey.');
assert.match(app, /function MonthSavingsSettings\(\{ state, monthKey, mutate \}\)/, 'Savings settings must be month scoped.');
assert.match(app, /const items = state\.savingsByMonth\?\.\[monthKey\] \|\| \[\];/, 'Savings settings must read the selected month snapshot only.');
assert.match(app, /type: 'SET_SAVINGS_ACCOUNTS', monthKey, items: nextItems/, 'Savings settings edits must write only to the selected month.');
assert.doesNotMatch(app, /ReferenceEditor field="savingsAccounts" items=\{state\.savingsAccounts \|\| \[\]\}/, 'Settings must not display the global reusable savings list.');
assert.match(clear, /savingsByMonth: withoutKey\(state\.savingsByMonth, monthKey\)/, 'Reset month must delete its savings snapshot.');
assert.match(app, /const masterSavingsAccounts = state\.savingsAccounts \|\| \[\];/, 'v82 must not alter the existing Savings-tab master-list logic.');
assert.match(app, /const \[adding, setAdding\] = useState\(false\);/, 'v82 must not remove Savings-tab React state.');

console.log('v82 month savings settings regression passed');
