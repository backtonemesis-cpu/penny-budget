import assert from 'node:assert/strict';
import { createBlankState, monthSummary } from '../src/finance.js';
import { appReducer, referenceInUse } from '../src/state.js';
import { buildMonthSetupCopies, recurringBillSetup } from '../src/month-setup.js';

const base = {
  ...createBlankState(),
  people: [{ id: 'person-a', label: 'Person A' }],
  accounts: [{ id: 'bank-old', label: 'Old Bank', ownerId: 'person-a' }],
  txnsByMonth: {
    '2026-06': [{
      id: 'old-expense',
      type: 'expense',
      amount: 50,
      category: 'rent_mortgage',
      expenseClass: 'fixed',
      date: '2026-06-05',
      desc: 'Rent',
      paid: true,
      paidBy: 'person-a',
      paidByLabel: 'Person A',
      account: 'bank-old',
      accountLabel: 'Old Bank',
      accountOwnerId: 'person-a',
      accountOwnerLabel: 'Person A',
      confirmationIssues: [],
      dateConfirmed: true,
      needsConfirmation: false,
      source: 'manual',
    }],
  },
  incomeByMonth: {
    '2026-06': [{
      id: 'old-income',
      date: '2026-06-01',
      amount: 100,
      amountConfirmed: true,
      incomeStatus: 'received',
      recurrenceMode: 'fixed',
      description: 'Child Benefit',
      incomeType: 'Child Benefit',
      receivedBy: 'person-a',
      receivedByLabel: 'Person A',
      account: 'bank-old',
      accountLabel: 'Old Bank',
      accountOwnerId: 'person-a',
      accountOwnerLabel: 'Person A',
      confirmationIssues: [],
      dateConfirmed: true,
      needsConfirmation: false,
      source: 'manual',
    }],
  },
  bankBalancesByMonth: {
    '2026-06': [{ id: 'bank-old', label: 'Old Bank', balance: 25, ownerId: 'person-a', ownerLabel: 'Person A' }],
  },
  monthMetaByMonth: {
    '2026-06': { status: 'complete', startingSavings: 100, startingSavingsConfirmed: true },
  },
};

assert.equal(referenceInUse(base, 'accounts', 'bank-old'), false, 'A bank must be removable from the master account list even when historical evidence references it.');

const openUsage = {
  ...base,
  txnsByMonth: {
    ...base.txnsByMonth,
    '2026-08': [{
      ...base.txnsByMonth['2026-06'][0],
      id: 'open-expense',
      date: '2026-08-05',
      paid: false,
    }],
  },
  incomeByMonth: {
    ...base.incomeByMonth,
    '2026-08': [{
      ...base.incomeByMonth['2026-06'][0],
      id: 'open-income',
      date: '2026-08-01',
    }],
  },
  bankBalancesByMonth: {
    ...base.bankBalancesByMonth,
    '2026-08': [{ id: 'bank-old', label: 'Old Bank', balance: 10, ownerId: 'person-a', ownerLabel: 'Person A' }],
  },
};
assert.equal(referenceInUse(openUsage, 'accounts', 'bank-old'), false, 'An open-month reference must not suppress the Settings Remove option; existing records carry their own evidence snapshots.');

const removed = appReducer(openUsage, {
  type: 'SET_REFERENCE_LIST',
  field: 'accounts',
  items: [],
  auditAt: '2026-08-30T12:20:00.000Z',
  auditId: 'remove-old-bank',
  auditLabel: 'Remove Old Bank',
});
assert.equal(removed.accounts.length, 0, 'Removing a bank must remove it from the master Accounts list and future account choices.');
assert.equal(removed.txnsByMonth['2026-06'][0].account, 'bank-old', 'Historical transaction account ID must remain intact after master-account removal.');
assert.equal(removed.txnsByMonth['2026-06'][0].accountLabel, 'Old Bank', 'Historical transaction account label must remain intact.');
assert.equal(removed.incomeByMonth['2026-06'][0].accountLabel, 'Old Bank', 'Historical income evidence must remain intact.');
assert.equal(removed.bankBalancesByMonth['2026-06'][0].label, 'Old Bank', 'Historical bank-balance evidence must remain intact.');
assert.equal(removed.txnsByMonth['2026-08'][0].accountLabel, 'Old Bank', 'Open-month transaction evidence must also remain intact after master-account removal.');
assert.equal(removed.bankBalancesByMonth['2026-08'][0].label, 'Old Bank', 'Open-month bank-balance evidence must not be silently deleted.');
assert.equal(removed.auditLog[0].id, 'remove-old-bank', 'Removal must remain traceable in Change History.');

const removedSummary = monthSummary(removed, '2026-08');
assert.equal(removedSummary.transferPlan[0].account, 'unassigned', 'Removed banks must no longer remain active transfer-plan targets.');
assert.equal(removedSummary.transferPlan[0].accountLabel, '', 'A removed bank name must not appear as the active transfer-plan destination.');
assert.equal(removedSummary.accountFundingPlan[0].account, 'unassigned', 'Funding planning must require a current account after the old bank is removed.');
assert.equal(removedSummary.accountFundingPlan[0].hasCurrentBalance, false, 'A saved balance for a removed bank must not be reused for an unassigned funding target.');
assert.equal(removedSummary.totalTransferNeeded, 50, 'Removal must not change the amount of the unpaid bill; without an active account balance the full bill remains the working transfer requirement.');

const futureSource = {
  ...removed,
  txnsByMonth: {
    ...removed.txnsByMonth,
    '2026-08': [{
      ...removed.txnsByMonth['2026-08'][0],
      id: 'future-bill-source',
      date: '2026-08-05',
      paid: true,
    }],
  },
  incomeByMonth: {
    ...removed.incomeByMonth,
    '2026-08': [{
      ...removed.incomeByMonth['2026-08'][0],
      id: 'future-income-source',
      date: '2026-08-01',
      recurrenceMode: 'fixed',
    }],
  },
};
const setup = recurringBillSetup(futureSource, '2026-09');
const billCandidate = setup.candidates.find((candidate) => !candidate.duplicate);
const incomeCandidate = setup.incomeCandidates.find((candidate) => !candidate.duplicate);
const billId = billCandidate?.id;
const incomeId = incomeCandidate?.id;
assert.ok(billId, 'The recurring bill should remain available as a planning template.');
assert.ok(incomeId, 'The recurring income should remain available as a planning template.');
assert.equal(billCandidate.transaction.account, 'unassigned', 'Month-setup preview must show a removed bill account as TBC/unassigned rather than the removed bank.');
assert.equal(billCandidate.transaction.accountLabel, '', 'Month-setup preview must not show the removed bank name as a future account.');
assert.equal(incomeCandidate.record.account, 'unassigned', 'Month-setup preview must show removed income account as TBC/unassigned.');

let sequence = 0;
const copies = buildMonthSetupCopies(
  futureSource,
  '2026-09',
  { billIds: [billId], incomeIds: [incomeId] },
  (prefix) => `${prefix}-copy-${++sequence}`,
);
assert.equal(copies.bills[0].account, 'unassigned', 'A removed bank must never be copied into a future month bill.');
assert.equal(copies.bills[0].accountLabel, '', 'A future bill must not present the removed bank as a current account choice.');
assert.ok(copies.bills[0].confirmationIssues.includes('account'), 'A future bill copied from a removed bank must require account confirmation.');
assert.equal(copies.income[0].account, 'unassigned', 'A removed bank must never be copied into future regular income.');
assert.ok(copies.income[0].confirmationIssues.includes('account'), 'Future income copied from a removed bank must require account confirmation.');

const afterCopy = {
  ...futureSource,
  txnsByMonth: { ...futureSource.txnsByMonth, '2026-09': copies.bills },
  incomeByMonth: { ...futureSource.incomeByMonth, '2026-09': copies.income },
};
const repeatedSetup = recurringBillSetup(afterCopy, '2026-09');
assert.equal(repeatedSetup.candidates.find((candidate) => candidate.id === billId)?.duplicate, true, 'Removed-account templates must not be offered twice after their TBC copy already exists.');
assert.equal(repeatedSetup.incomeCandidates.find((candidate) => candidate.id === incomeId)?.duplicate, true, 'Removed-account income templates must not be offered twice after their TBC copy already exists.');

console.log('Penny always-removable account policy passed: master removal, evidence preservation, transfer planning and future TBC account handling are protected');
