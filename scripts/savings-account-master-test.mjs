import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { migrateState, monthSummary } from '../src/finance.js';
import { appReducer } from '../src/state.js';

const legacy = migrateState({
  version: 11,
  savingsByMonth: {
    '2026-08': [
      { id: 'save_chase', label: 'Chase', balance: 15000 },
      { id: 'save_santander', label: 'Santander', balance: 4000 },
    ],
    '2026-09': [
      { id: 'save_chase', label: 'Chase', balance: 15687.47 },
      { id: 'save_santander', label: 'Santander', balance: 4000 },
    ],
  },
}, new Date(2026, 8, 15));

assert.deepEqual(legacy.savingsAccounts, [
  { id: 'save_chase', label: 'Chase' },
  { id: 'save_santander', label: 'Santander' },
], 'existing monthly savings snapshots should migrate into a reusable savings-account master list');
assert.equal(monthSummary(legacy, '2026-09').currentSavings, 19687.47, 'migration must not alter the monthly savings total');

const renamedMaster = appReducer(legacy, {
  type: 'SET_REFERENCE_LIST',
  field: 'savingsAccounts',
  items: [
    { id: 'save_chase', label: 'Chase Saver' },
    { id: 'save_santander', label: 'Santander' },
  ],
  auditAt: '2026-08-30T19:00:00.000Z',
});
assert.equal(renamedMaster.savingsAccounts[0].label, 'Chase Saver');
assert.equal(renamedMaster.savingsByMonth['2026-09'][0].label, 'Chase', 'renaming the reusable master choice must not rewrite historical saved labels');

const removedMaster = appReducer(renamedMaster, {
  type: 'SET_REFERENCE_LIST',
  field: 'savingsAccounts',
  items: [{ id: 'save_santander', label: 'Santander' }],
  auditAt: '2026-08-30T19:01:00.000Z',
});
assert.equal(removedMaster.savingsAccounts.length, 1);
assert.equal(removedMaster.savingsByMonth['2026-09'].length, 2, 'removing a master savings choice must not delete historical month snapshots');
assert.equal(monthSummary(removedMaster, '2026-09').currentSavings, 19687.47, 'master-list cleanup must not change savings evidence');

const app = await readFile('src/App.jsx', 'utf8');
assert.match(app, /<h3>Savings Accounts<\/h3>/, 'Settings must expose a Savings Accounts master list');
assert.match(app, /field="savingsAccounts"/, 'Savings Settings must use the reusable reference editor');
assert.match(app, /id="savings-account-select"/, 'monthly Savings must select from the master savings accounts');
assert.match(app, /PENNY_V40_SAVINGS_EDITOR/, 'compact balance-only savings editor must be installed');
assert.doesNotMatch(app, /saving-label-\$\{account\.id\}/, 'monthly savings editing must not ask the user to retype the account name');
assert.match(app, /onSavingsDetails=\{\(\) => setView\('Savings'\)\}/, 'Overview Savings must route directly to Savings');
assert.match(app, /onClick=\{onSavingsDetails\}/, 'Savings Snapshot card must be actionable');
assert.match(app, /action\.type === 'SET_REFERENCE_LIST' && \['people', 'accounts'\]\.includes\(action\.field\)/, 'only people/accounts may be redirected into month-scoped Settings; savings accounts must remain global');
assert.match(app, /!summary\.isComplete && \(/, 'Savings Goal planning must remain hidden for completed historical months');

const storage = await readFile('src/storage.js', 'utf8');
assert.match(storage, /savingsAccounts: mergeById\(current\.savingsAccounts, incoming\.savingsAccounts\)/, 'month import must merge reusable savings-account references safely');
assert.match(storage, /savingsAccounts: \(state\.savingsAccounts \|\| \[\]\)\.filter/, 'month-only exports must carry the savings-account references used by that month');

console.log('savings account master regression passed');
