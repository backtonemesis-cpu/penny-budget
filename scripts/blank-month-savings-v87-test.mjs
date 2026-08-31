import assert from 'node:assert/strict';
import { CURRENT_STATE_VERSION, migrateState } from '../src/finance.js';

const now = new Date(2026, 9, 15, 12, 0, 0);

const currentVersionState = {
  version: CURRENT_STATE_VERSION,
  txnsByMonth: {},
  incomeByMonth: {},
  customCats: [],
  hiddenCats: [],
  people: [],
  accounts: [],
  savingsAccounts: [
    { id: 'saving_chase', label: 'Chase' },
    { id: 'saving_santander', label: 'Santander' },
    { id: 'saving_cash', label: 'Cash' },
  ],
  savingsByMonth: {},
  bankBalancesByMonth: {},
  monthMetaByMonth: {},
  budgetsByMonth: {},
  dueDays: {},
  auditLog: [],
};

const migratedCurrent = migrateState(currentVersionState, now);
assert.deepEqual(
  migratedCurrent.savingsByMonth,
  {},
  'A current-version state with a reusable savings master list and no monthly snapshot must stay blank after migration.',
);
assert.deepEqual(
  (migratedCurrent.savingsAccounts || []).map((item) => item.label),
  ['Chase', 'Santander', 'Cash'],
  'Resetting one month must not destroy legacy reusable definitions that may still support other historical months.',
);

const legacyState = {
  ...currentVersionState,
  version: Math.max(0, CURRENT_STATE_VERSION - 1),
  savingsAccounts: [
    { id: 'legacy_chase', label: 'Chase', balance: 321.45 },
  ],
};
const migratedLegacy = migrateState(legacyState, now);
assert.equal(
  Object.values(migratedLegacy.savingsByMonth).flat().some((item) => item.label === 'Chase'),
  true,
  'A genuinely older state format must still be allowed to migrate its legacy savings snapshot once.',
);

console.log('v87/v95 blank-month savings regression passed');
