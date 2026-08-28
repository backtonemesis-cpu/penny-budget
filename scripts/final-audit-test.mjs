import assert from 'node:assert/strict';
import {
  CURRENT_STATE_VERSION,
  annualSummary,
  createBlankState,
} from '../src/finance.js';
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

console.log('Penny final evidence-status and future-format recovery tests passed');
