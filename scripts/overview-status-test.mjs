import assert from 'node:assert/strict';
import { overviewActionableIncompleteCount } from '../src/overview-status.js';

const copiedDateOnly = {
  id: 'copied-date-only',
  source: 'month_copy',
  confirmationIssues: ['date'],
};
const manualDateTbc = {
  id: 'manual-date-tbc',
  source: 'manual',
  confirmationIssues: ['date'],
};
const copiedMissingAccount = {
  id: 'copied-missing-account',
  source: 'month_copy',
  confirmationIssues: ['date', 'account'],
};
const completeRecord = {
  id: 'complete-record',
  source: 'manual',
  confirmationIssues: [],
};

assert.equal(overviewActionableIncompleteCount({
  isComplete: false,
  incompleteRecords: 13,
  transactions: Array.from({ length: 13 }, (_, index) => ({ ...copiedDateOnly, id: `copy-${index}` })),
  incomeRecords: [],
}), 0, 'Date-only TBC flags created by Start New Month must not become a large live Overview warning.');

assert.equal(overviewActionableIncompleteCount({
  isComplete: false,
  incompleteRecords: 3,
  transactions: [copiedDateOnly, manualDateTbc, copiedMissingAccount, completeRecord],
  incomeRecords: [],
}), 2, 'Manual date uncertainty and missing account evidence must remain actionable on a live month.');

assert.equal(overviewActionableIncompleteCount({
  isComplete: false,
  incompleteRecords: 1,
  transactions: [completeRecord],
  incomeRecords: [{ source: 'manual', confirmationIssues: ['receivedBy'] }],
}), 1, 'Incomplete income evidence must remain actionable.');

assert.equal(overviewActionableIncompleteCount({
  isComplete: true,
  incompleteRecords: 13,
  transactions: Array.from({ length: 13 }, (_, index) => ({ ...copiedDateOnly, id: `copy-${index}` })),
  incomeRecords: [],
}), 13, 'Completed months must surface every incomplete evidence record, including copied dates that were never confirmed.');

console.log('Penny Overview status regression tests passed');
