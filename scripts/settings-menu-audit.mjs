import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankState } from '../src/finance.js';
import { appReducer, categoryInUse, referenceInUse } from '../src/state.js';
import {
  STORAGE_KEY,
  ROLLBACK_STORAGE_KEY,
  clearPennyState,
  clearRollbackState,
  createBackupText,
  hasRollbackState,
  loadRollbackState,
  parseBackupPackage,
  saveRollbackState,
  saveState,
} from '../src/storage.js';

class MemoryStorage {
  constructor() { this.items = new Map(); }
  getItem(key) { return this.items.has(key) ? this.items.get(key) : null; }
  setItem(key, value) { this.items.set(key, String(value)); }
  removeItem(key) { this.items.delete(key); }
}

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const mobileCss = await readFile(new URL('../src/mobile-navigation.css', import.meta.url), 'utf8');

// Settings must expose every current maintenance/recovery area and keep recovery-safe behaviour.
assert.match(appSource, /function SettingsModal\(/, 'SettingsModal must remain present.');
for (const heading of ['App Version', 'Household People', 'Accounts', 'Categories', 'Change History', 'Backup and Recovery']) {
  assert.ok(appSource.includes(heading), `Settings must retain the ${heading} area.`);
}
assert.match(appSource, /disabled=\{recoveryRequired\}[^>]*onClick=\{onExport\}/s, 'Normal backup export must remain disabled during protected recovery.');
assert.match(appSource, /accept="application\/json,\.json"[^>]*onChange=\{onImport\}/s, 'Backup import must remain restricted to JSON files.');
assert.match(appSource, /rollbackAvailable && <button[^>]*onClick=\{onRestorePreviousImport\}/s, 'Automatic pre-import rollback must remain available when present.');
assert.match(appSource, /Erase Penny data on this device/, 'The local-data erase action must remain clearly labelled.');
assert.match(appSource, /globalThis\.confirm\('Erase all data stored by Penny on this device\? This cannot be undone without a separate exported backup\.'\)/, 'Erase must keep an explicit destructive-action confirmation.');

// Dialog accessibility and iPhone interaction protections.
assert.match(appSource, /role="dialog" aria-modal="true" aria-labelledby=\{titleId\}/, 'Settings must render inside an accessible modal dialog.');
assert.match(appSource, /if \(event\.key === 'Escape'\)/, 'Modal must support Escape to close.');
assert.match(appSource, /event\.key !== 'Tab'/, 'Modal must keep keyboard focus trapped inside the dialog.');
assert.match(mobileCss, /Settings cleanup: dense single-row records, less explanatory copy and much shorter scrolling\./, 'The cleaned mobile Settings optimisation must remain active.');
assert.match(mobileCss, /\.wide-modal > \.settings-section \{[^}]*border-radius: 12px;[^}]*padding: 9px 10px;/s, 'Settings sections must remain compact card-like groups on mobile.');
assert.match(mobileCss, /\.wide-modal > \.settings-section:not\(:first-of-type\):not\(:last-of-type\) > \.section-note \{[^}]*display: none;/s, 'Routine explanatory copy must stay suppressed so Settings remains easy to scan.');
assert.match(mobileCss, /\.wide-modal \.account-settings-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) 108px 58px;/s, 'Each account must stay on one compact row with name, owner and status/action.');
assert.match(mobileCss, /\.wide-modal \.settings-row > \.danger-button:disabled \{[^}]*opacity: 1;/s, 'Protected people/categories must read as compact status rather than a faded oversized disabled control.');
assert.match(mobileCss, /\.wide-modal \.icon-grid \{[^}]*display: flex;[^}]*overflow-x: auto;/s, 'Category icons must remain a single horizontal strip instead of a tall grid.');
assert.match(mobileCss, /\.wide-modal \.stacked-actions \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/s, 'Backup actions must remain space-efficient on mobile.');
assert.match(mobileCss, /\.wide-modal > \.settings-section:last-child > \.danger-button \{[^}]*font-size: 11px;/s, 'The erase control must remain visually secondary while still clearly destructive.');

// Active account ownership protects a person. Historical rows alone must not permanently lock master-list people/accounts.
const referenceState = {
  ...createBlankState(),
  people: [{ id: 'person-a', label: 'Person A' }, { id: 'person-b', label: 'Person B' }],
  accounts: [
    { id: 'account-a', label: 'Account A', ownerId: 'person-a' },
    { id: 'account-b', label: 'Account B', ownerId: 'person-b' },
  ],
  txnsByMonth: {
    '2026-08': [
      { id: 'txn-a', type: 'expense', category: 'housing', paidBy: 'person-a', paidByLabel: 'Person A', account: 'account-a', accountLabel: 'Account A' },
    ],
  },
  incomeByMonth: {
    '2026-08': [
      { id: 'income-a', receivedBy: 'person-b', receivedByLabel: 'Person B', account: 'account-b', accountLabel: 'Account B' },
    ],
  },
  bankBalancesByMonth: {
    '2026-08': [{ id: 'account-a', label: 'Account A', balance: 100 }],
  },
};
assert.equal(referenceInUse(referenceState, 'people', 'person-a'), true, 'A person must remain protected while they own an active account.');
assert.equal(referenceInUse(referenceState, 'people', 'person-b'), true, 'An active account owner must remain protected even when income also references them.');
assert.equal(referenceInUse(referenceState, 'accounts', 'account-a'), false, 'A bank must remain removable even when an open transaction/balance references it, because the record keeps its own account evidence.');
assert.equal(referenceInUse(referenceState, 'accounts', 'account-b'), false, 'A bank used by open-month income must still offer Remove in Settings.');
assert.equal(referenceInUse(referenceState, 'accounts', 'unused-account'), false, 'An unused account should remain removable.');
assert.equal(categoryInUse(referenceState, 'housing'), true, 'A category used by historical records cannot be deleted.');
assert.equal(categoryInUse(referenceState, 'unused-category'), false, 'An unused custom category should remain removable.');

const noActiveAccountsState = { ...referenceState, accounts: [] };
assert.equal(referenceInUse(noActiveAccountsState, 'people', 'person-a'), false, 'A historical payer must become removable after active accounts are removed or reassigned.');
assert.equal(referenceInUse(noActiveAccountsState, 'people', 'person-b'), false, 'A historical income recipient must become removable after active accounts are removed or reassigned.');
const removedPeopleState = appReducer(noActiveAccountsState, {
  type: 'SET_REFERENCE_LIST',
  field: 'people',
  items: [],
  auditAt: '2026-08-30T10:00:20.000Z',
  auditId: 'audit-remove-people',
  auditLabel: 'Remove household people',
});
assert.equal(removedPeopleState.people.length, 0, 'All household people must be removable from a clean master template once no active account owns them.');
assert.equal(removedPeopleState.txnsByMonth['2026-08'][0].paidByLabel, 'Person A', 'Removing a person must not rewrite the saved payer evidence on historical transactions.');
assert.equal(removedPeopleState.incomeByMonth['2026-08'][0].receivedByLabel, 'Person B', 'Removing a person must not rewrite the saved recipient evidence on historical income.');
assert.equal(removedPeopleState.auditLog[0].id, 'audit-remove-people', 'Removing household people must remain auditable.');

const completedReferenceState = {
  ...referenceState,
  monthMetaByMonth: {
    '2026-08': { status: 'complete', startingSavings: 1000, startingSavingsConfirmed: true },
  },
};
assert.equal(referenceInUse(completedReferenceState, 'accounts', 'account-a'), false, 'A bank used only in a completed month must be removable from the master account list.');
assert.equal(referenceInUse(completedReferenceState, 'accounts', 'account-b'), false, 'Completed-month income must not keep an old bank permanently in Settings.');
const accountsAfterHistoricalRemoval = completedReferenceState.accounts.filter((account) => account.id !== 'account-a');
const removedHistoricalAccountState = appReducer(completedReferenceState, {
  type: 'SET_REFERENCE_LIST',
  field: 'accounts',
  items: accountsAfterHistoricalRemoval,
  auditAt: '2026-08-30T10:00:30.000Z',
  auditId: 'audit-remove-historical-account',
  auditLabel: 'Remove Account A',
});
assert.equal(removedHistoricalAccountState.accounts.some((account) => account.id === 'account-a'), false, 'Removed bank must leave future account choices.');
assert.equal(removedHistoricalAccountState.txnsByMonth['2026-08'][0].accountLabel, 'Account A', 'Removing a bank must not rewrite its saved transaction label.');
assert.equal(removedHistoricalAccountState.bankBalancesByMonth['2026-08'][0].label, 'Account A', 'Removing a bank must not erase its month-specific balance evidence.');
assert.equal(removedHistoricalAccountState.auditLog[0].id, 'audit-remove-historical-account', 'Removing a bank must remain traceable in Change History.');

const mixedReferenceState = {
  ...completedReferenceState,
  txnsByMonth: {
    ...completedReferenceState.txnsByMonth,
    '2026-09': [{ id: 'txn-sep', type: 'expense', category: 'housing', paidBy: 'person-a', paidByLabel: 'Person A', account: 'account-a', accountLabel: 'Account A' }],
  },
};
assert.equal(referenceInUse(mixedReferenceState, 'accounts', 'account-a'), false, 'Open-month usage must not suppress the bank Remove option.');

// Settings-originated reference changes must remain auditable.
const changedPeople = [...referenceState.people, { id: 'person-c', label: 'Person C' }];
const auditedState = appReducer(referenceState, {
  type: 'SET_REFERENCE_LIST',
  field: 'people',
  items: changedPeople,
  auditAt: '2026-08-30T10:00:00.000Z',
  auditId: 'audit-settings-test',
  auditLabel: 'Add Person C',
});
assert.equal(auditedState.people.length, 3, 'Reference updates must apply.');
assert.equal(auditedState.auditLog[0].id, 'audit-settings-test', 'Reference updates must create a Change History entry.');
assert.equal(auditedState.auditLog[0].entityType, 'people', 'Reference audit entry must identify the affected settings area.');
assert.deepEqual(auditedState.auditLog[0].before, referenceState.people, 'Reference audit must retain the before-state.');
assert.deepEqual(auditedState.auditLog[0].after, changedPeople, 'Reference audit must retain the after-state.');

// Backup, import parsing, rollback and erase controls used by Settings must round-trip safely.
const backupText = createBackupText(auditedState, new Date('2026-08-30T10:05:00.000Z'));
const parsedBackup = parseBackupPackage(backupText, new Date('2026-08-30T10:06:00.000Z'));
assert.equal(parsedBackup.importMode, 'replace', 'A normal Settings export must re-import as a full replacement backup.');
assert.equal(parsedBackup.state.people.some((person) => person.id === 'person-c'), true, 'Backup round-trip must preserve Settings reference data.');
assert.equal(parsedBackup.state.auditLog.some((entry) => entry.id === 'audit-settings-test'), true, 'Backup round-trip must preserve Change History.');

const storage = new MemoryStorage();
assert.deepEqual(saveState(storage, auditedState), { ok: true, error: '' }, 'Settings data must be saveable to browser storage.');
assert.ok(storage.getItem(STORAGE_KEY), 'Primary Penny storage must be populated after save.');
assert.deepEqual(saveRollbackState(storage, auditedState), { ok: true, error: '' }, 'Pre-import rollback must be creatable.');
assert.equal(hasRollbackState(storage), true, 'Settings must detect an available rollback copy.');
const rollback = loadRollbackState(storage, new Date('2026-08-30T10:07:00.000Z'));
assert.equal(rollback.people.some((person) => person.id === 'person-c'), true, 'Rollback restore must preserve Settings reference data.');
clearRollbackState(storage);
assert.equal(storage.getItem(ROLLBACK_STORAGE_KEY), null, 'Rollback cleanup must remove only the rollback copy.');
assert.ok(storage.getItem(STORAGE_KEY), 'Rollback cleanup must leave the primary Penny state intact.');
assert.deepEqual(clearPennyState(storage), { ok: true, error: '' }, 'Explicit erase must complete successfully in healthy storage.');
assert.equal(storage.getItem(STORAGE_KEY), null, 'Explicit erase must remove the primary Penny state.');
assert.equal(storage.getItem(ROLLBACK_STORAGE_KEY), null, 'Explicit erase must also remove stale rollback data.');

console.log('Penny Settings menu audit passed: removable people/accounts with preserved historical evidence, protected active ownership/categories, recovery, backups, audit trail, accessibility and compact mobile UX are protected');
