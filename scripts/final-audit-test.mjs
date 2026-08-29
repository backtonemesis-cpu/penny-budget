import assert from 'node:assert/strict';
import {
  CURRENT_STATE_VERSION,
  annualSummary,
  createBlankState,
  migrateState,
  monthSummary,
  migrateState,
  monthSummary,
} from '../src/finance.js';
import { appReducer } from '../src/state.js';
import {
  loadState,
  parseBackupPackage,
} from '../src/storage.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

const emptyYear = annualSummary(createBlankState(), 2026);
assert.equal(emptyYear.auditReady, false);
assert.equal(emptyYear.evidenceStatus, 'empty', 'An empty year must not be described as Ready or Review.');

const explicitZeroStart = migrateState({
  ...createBlankState(),
  monthMetaByMonth: { '2026-01': { status: 'complete', startingSavings: 0 } },
}, new Date(2026, 0, 31));
assert.equal(monthSummary(explicitZeroStart, '2026-01').startingSavingsConfirmed, true, 'An explicit zero starting balance is valid evidence.');

const missingStart = migrateState({
  ...createBlankState(),
  monthMetaByMonth: { '2026-02': { status: 'complete' } },
  savingsByMonth: { '2026-02': [{ id: 's0', label: 'Savings', balance: 0 }] },
}, new Date(2026, 1, 28));
const missingStartSummary = monthSummary(missingStart, '2026-02');
assert.equal(missingStartSummary.startingSavingsConfirmed, false, 'Missing starting savings must remain TBC rather than becoming a synthetic zero.');
assert.equal(missingStartSummary.expectedClosingSavings, null);
assert.equal(missingStartSummary.auditReady, false);

const rawLegacyComplete = {
  ...createBlankState(),
  monthMetaByMonth: { '2026-03': { status: 'complete', startingSavings: 8000 } },
  savingsByMonth: { '2026-03': [{ id: 's1', label: 'Savings', balance: 8000 }] },
};
assert.equal(monthSummary(rawLegacyComplete, '2026-03').startingSavingsConfirmed, true, 'Existing valid pre-flag state must remain compatible.');

const subPennySavings = appReducer(createBlankState(), {
  type: 'SET_SAVINGS_ACCOUNTS',
  monthKey: '2026-08',
  items: [{ id: 's1', label: 'Savings', balance: 100.001 }],
  auditAt: '2026-08-28T12:00:00.000Z',
  auditId: 'audit-savings-rounding',
});
assert.equal(subPennySavings.savingsByMonth['2026-08'][0].balance, 100, 'Stored savings evidence must be normalised to pennies.');
assert.equal(subPennySavings.auditLog[0].after[0].balance, 100, 'Change History must record the penny-normalised savings value.');

const missingStart = migrateState({
  version: CURRENT_STATE_VERSION,
  monthMetaByMonth: { '2026-06': { status: 'complete', startingSavings: null } },
  savingsByMonth: { '2026-06': [{ id: 's', label: 'Savings', balance: 0 }] },
}, new Date(2026, 5, 30));
const missingStartSummary = monthSummary(missingStart, '2026-06');
assert.equal(missingStartSummary.startingSavingsConfirmed, false, 'Null starting savings must remain missing evidence, not become an explicit zero.');
assert.equal(missingStartSummary.expectedClosingSavings, null);
assert.equal(missingStartSummary.closingVariance, null);
assert.equal(missingStartSummary.auditReady, false);
assert.equal(missingStartSummary.evidenceStatus, 'review');

const blankStart = migrateState({
  version: CURRENT_STATE_VERSION,
  monthMetaByMonth: { '2026-06': { status: 'complete', startingSavings: '   ' } },
  savingsByMonth: { '2026-06': [{ id: 's', label: 'Savings', balance: 0 }] },
}, new Date(2026, 5, 30));
assert.equal(monthSummary(blankStart, '2026-06').startingSavingsConfirmed, false, 'Blank starting savings must remain missing evidence.');

const explicitZeroStart = migrateState({
  version: CURRENT_STATE_VERSION,
  monthMetaByMonth: { '2026-06': { status: 'complete', startingSavings: 0 } },
  savingsByMonth: { '2026-06': [{ id: 's', label: 'Savings', balance: 0 }] },
}, new Date(2026, 5, 30));
const explicitZeroSummary = monthSummary(explicitZeroStart, '2026-06');
assert.equal(explicitZeroSummary.startingSavingsConfirmed, true, 'An explicitly supplied £0 starting balance is valid evidence.');
assert.equal(explicitZeroSummary.expectedClosingSavings, 0);
assert.equal(explicitZeroSummary.closingVariance, 0);
assert.equal(explicitZeroSummary.auditReady, true);
assert.equal(explicitZeroSummary.evidenceStatus, 'ready');

const futureState = { ...createBlankState(), version: CURRENT_STATE_VERSION + 1 };
const futureStorage = memoryStorage({ penny_state: JSON.stringify(futureState) });
const futureLoad = loadState(futureStorage, new Date(2026, 7, 28));
assert.equal(futureLoad.recoveryRequired, true, 'Newer local data must be protected from overwrite by an older app build.');
assert.match(futureLoad.warning, /newer Penny data format/);

assert.throws(
  () => parseBackupPackage(JSON.stringify({ app: 'Penny', state: futureState })),
  /newer Penny state format/,
  'A raw backup with a future state version must be rejected even if formatVersion is absent.',
);

console.log('Penny final evidence-status, starting-savings, penny-storage and future-format recovery tests passed');
