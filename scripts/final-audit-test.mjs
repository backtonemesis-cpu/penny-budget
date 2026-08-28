import assert from 'node:assert/strict';
import {
  CURRENT_STATE_VERSION,
  annualSummary,
  createBlankState,
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

const subPennySavings = appReducer(createBlankState(), {
  type: 'SET_SAVINGS_ACCOUNTS',
  monthKey: '2026-08',
  items: [{ id: 's1', label: 'Savings', balance: 100.001 }],
  auditAt: '2026-08-28T12:00:00.000Z',
  auditId: 'audit-savings-rounding',
});
assert.equal(subPennySavings.savingsByMonth['2026-08'][0].balance, 100, 'Stored savings evidence must be normalised to pennies.');
assert.equal(subPennySavings.auditLog[0].after[0].balance, 100, 'Change History must record the penny-normalised savings value.');

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

console.log('Penny final evidence-status, penny-storage and future-format recovery tests passed');
