import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankState, migrateState } from '../src/finance.js';
import { appReducer } from '../src/state.js';
import { getMonthAccounts, getMonthPeople } from '../src/month-scope.js';
import { createBackupText, mergeImportedMonths, parseBackupPackage } from '../src/storage.js';

const legacy = {
  ...createBlankState(),
  version: 10,
  people: [{ id: 'm', label: 'Marius' }, { id: 'v', label: 'Vesta' }],
  accounts: [{ id: 'a', label: 'Bank A', ownerId: 'm' }],
  txnsByMonth: {
    '2026-08': [{ id: 't1', type: 'expense', amount: 10, category: 'other', expenseClass: 'variable', date: '2026-08-10', desc: 'August item', paid: true, paidBy: 'm', paidByLabel: 'Marius', account: 'a', accountLabel: 'Bank A', confirmationIssues: [] }],
    '2026-09': [{ id: 't2', type: 'expense', amount: 20, category: 'other', expenseClass: 'variable', date: '2026-09-10', desc: 'September item', paid: true, paidBy: 'm', paidByLabel: 'Marius', account: 'a', accountLabel: 'Bank A', confirmationIssues: [] }],
  },
};
const migrated = migrateState(legacy, new Date('2026-08-30T12:00:00Z'));
assert.equal(migrated.version, 11, 'v28 must use state version 11.');
assert.deepEqual(getMonthPeople(migrated, '2026-08').map((p) => p.label), ['Marius', 'Vesta']);
assert.deepEqual(getMonthAccounts(migrated, '2026-09').map((a) => a.label), ['Bank A']);

const augustChanged = appReducer(migrated, { type: 'SET_MONTH_REFERENCE_LIST', monthKey: '2026-08', field: 'people', items: [{ id: 'm', label: 'Marius August' }], audit: false });
assert.equal(getMonthPeople(augustChanged, '2026-08')[0].label, 'Marius August', 'August people must be independently editable.');
assert.equal(getMonthPeople(augustChanged, '2026-09')[0].label, 'Marius', 'Editing August must not alter September people.');

const startedOctober = appReducer(migrated, {
  type: 'START_NEW_MONTH', monthKey: '2026-10', sourceMonthKey: '2026-09', bills: [], income: [],
  copyPeople: true, copyAccounts: true, copyCategories: true, copyBudget: false, copyBankBalances: false, copySavings: false, audit: false,
});
assert.deepEqual(getMonthPeople(startedOctober, '2026-10').map((p) => p.label), ['Marius', 'Vesta'], 'New month must copy selected people as an independent list.');
assert.deepEqual(getMonthAccounts(startedOctober, '2026-10').map((a) => a.label), ['Bank A'], 'New month must copy selected accounts.');

const monthBackupText = createBackupText(migrated, new Date('2026-08-30T12:00:00Z'), { scope: 'month', monthKey: '2026-08' });
const monthPackage = parseBackupPackage(monthBackupText, new Date('2026-08-30T12:01:00Z'));
assert.equal(monthPackage.scope, 'month');
assert.equal(monthPackage.importMode, 'merge_months');
assert.deepEqual(monthPackage.mergeMonths, ['2026-08']);
assert.equal(monthPackage.state.txnsByMonth['2026-09'], undefined, 'Month export must not contain another month.');

const destination = migrateState({ ...legacy, peopleByMonth: { '2026-08': [{ id: 'x', label: 'Old August' }], '2026-09': [{ id: 'z', label: 'September Safe' }] } }, new Date('2026-08-30T12:02:00Z'));
const merged = mergeImportedMonths(destination, monthPackage.state, ['2026-08'], new Date('2026-08-30T12:03:00Z'));
assert.equal(getMonthPeople(merged, '2026-08')[0].label, 'Marius', 'Month import must replace imported month setup.');
assert.equal(getMonthPeople(merged, '2026-09')[0].label, 'September Safe', 'Month import must preserve every other month setup.');

const fullPackage = parseBackupPackage(createBackupText(migrated, new Date('2026-08-30T12:04:00Z'), { scope: 'all' }));
assert.equal(fullPackage.scope, 'all');
assert.equal(fullPackage.importMode, 'replace');

const clearSource = await readFile(new URL('../src/month-clear.js', import.meta.url), 'utf8');
for (const required of ['peopleByMonth: emptyMonthList', 'accountsByMonth: emptyMonthList', 'hiddenCatsByMonth: emptyMonthList', 'savingsByMonth: withoutKey', 'No other month is changed']) {
  assert.ok(clearSource.includes(required), `Clear month must protect standalone scope: ${required}`);
}

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
for (const label of ['Export current month', 'Export a specific month', 'Export all Penny data', 'Household people', 'Accounts + owners', 'Current bank balances', 'Savings snapshot', 'Select all reusable setup']) {
  assert.ok(appSource.includes(label), `v28 UI must expose: ${label}`);
}
assert.ok(appSource.includes('monthScopedSettingsState'), 'Settings must use selected-month people/accounts instead of global master references.');

console.log('Penny v28 standalone-month, selective-copy and scoped backup regression passed.');
