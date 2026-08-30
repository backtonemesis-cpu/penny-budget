import assert from 'node:assert/strict';
import { createBlankState } from '../src/finance.js';
import { appReducer, referenceInUse } from '../src/state.js';

const base = {
  ...createBlankState(),
  accounts: [{ id: 'bank-old', label: 'Old Bank', ownerId: 'unassigned' }],
  txnsByMonth: {
    '2026-06': [{ id: 'old-expense', type: 'expense', account: 'bank-old', accountLabel: 'Old Bank' }],
  },
  incomeByMonth: {
    '2026-06': [{ id: 'old-income', account: 'bank-old', accountLabel: 'Old Bank' }],
  },
  bankBalancesByMonth: {
    '2026-06': [{ id: 'bank-old', label: 'Old Bank', balance: 25 }],
  },
  monthMetaByMonth: {
    '2026-06': { status: 'complete', startingSavings: 100, startingSavingsConfirmed: true },
  },
};

assert.equal(referenceInUse(base, 'accounts', 'bank-old'), false, 'Completed historical usage must not permanently pin an account in Settings.');

const removed = appReducer(base, {
  type: 'SET_REFERENCE_LIST',
  field: 'accounts',
  items: [],
  auditAt: '2026-08-30T11:20:00.000Z',
  auditId: 'remove-old-bank',
  auditLabel: 'Remove Old Bank',
});
assert.equal(removed.accounts.length, 0, 'Historical-only bank must be removable from active Accounts.');
assert.equal(removed.txnsByMonth['2026-06'][0].accountLabel, 'Old Bank', 'Historical transaction evidence must stay intact.');
assert.equal(removed.incomeByMonth['2026-06'][0].accountLabel, 'Old Bank', 'Historical income evidence must stay intact.');
assert.equal(removed.bankBalancesByMonth['2026-06'][0].label, 'Old Bank', 'Historical bank-balance evidence must stay intact.');
assert.equal(removed.auditLog[0].id, 'remove-old-bank', 'Removal must remain traceable in Change History.');

const stillActive = {
  ...base,
  txnsByMonth: {
    ...base.txnsByMonth,
    '2026-09': [{ id: 'new-expense', type: 'expense', account: 'bank-old', accountLabel: 'Old Bank' }],
  },
};
assert.equal(referenceInUse(stillActive, 'accounts', 'bank-old'), true, 'An account referenced by an open month must remain protected.');

console.log('Penny inactive account removal policy passed');
