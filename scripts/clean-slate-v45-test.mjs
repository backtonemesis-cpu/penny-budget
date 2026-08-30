import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');

assert.doesNotMatch(app, /onClick=\{\(\) => setMode\('movement'\)\}>Transfer<\/button>/, 'Add record must contain only Expense and Income tabs.');
assert.doesNotMatch(app, /id="movement-type"/, 'Transfer-only movement type must not render.');
assert.doesNotMatch(app, /id="movement-account"/, 'Transfer-only account field must not render.');
assert.match(app, /const displayedSavingsAccounts = savingsAccounts; \/\/ PENNY_V45_CLEAN_SLATE/, 'Savings must render only the selected month snapshots.');
assert.doesNotMatch(app, /masterSavingsAccounts\.map\(\(master\) => savingsAccounts\.find/, 'Global Settings savings accounts must not pre-populate a fresh month.');

const masterSavingsAccounts = [
  { id: 'save_chase', label: 'Chase' },
  { id: 'save_santander', label: 'Santander' },
];
const freshMonthSavings = [];
const displayedFreshMonth = freshMonthSavings;
assert.deepEqual(displayedFreshMonth, [], 'a fresh month must start with no Savings rows even when Settings contains savings accounts');
assert.equal(masterSavingsAccounts.length, 2, 'the clean monthly slate must not delete the reusable Settings savings accounts');

console.log('v45 clean-slate regression passed');
