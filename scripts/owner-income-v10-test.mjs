import assert from 'node:assert/strict';
import { createBlankState, migrateState, monthSummary, normaliseIncomeRecord, normaliseTransaction } from '../src/finance.js';
import { buildMonthAccountSplitPlan } from '../src/account-resolution.js';
import { buildMonthSetupCopies, recurringBillSetup, recurringIncomeMode } from '../src/month-setup.js';
import { appReducer } from '../src/state.js';

const p1 = { id: 'p1', label: 'Person 1' };
const p2 = { id: 'p2', label: 'Person 2' };
const ambiguous = { id: 'legacy-bank', label: 'Bank', ownerId: 'unassigned' };
const base = {
  ...createBlankState(), people: [p1,p2], accounts: [ambiguous], budgetsByMonth: { '2026-09': { household: 800 } },
  txnsByMonth: {
    '2026-09': [
      normaliseTransaction({ id:'b1', type:'expense', date:'2026-09-02', amount:100, desc:'Bill A', category:'other', expenseClass:'fixed', paid:true, paidBy:'p1', account:'legacy-bank', confirmationIssues:[] }),
      normaliseTransaction({ id:'b2', type:'expense', date:'2026-09-03', amount:200, desc:'Bill B', category:'other', expenseClass:'fixed', paid:true, paidBy:'p2', account:'legacy-bank', confirmationIssues:[] }),
    ],
    '2026-10': [
      normaliseTransaction({ id:'o1', type:'expense', date:'2026-10-02', amount:100, desc:'Bill A', category:'other', expenseClass:'fixed', paid:false, paidBy:'p1', account:'legacy-bank', confirmationIssues:['date'], dateConfirmed:false, source:'month_copy' }),
      normaliseTransaction({ id:'o2', type:'expense', date:'2026-10-03', amount:200, desc:'Bill B', category:'other', expenseClass:'fixed', paid:false, paidBy:'p2', account:'legacy-bank', confirmationIssues:['date'], dateConfirmed:false, source:'month_copy' }),
    ],
  },
  incomeByMonth: {
    '2026-09': [
      normaliseIncomeRecord({ id:'cb', date:'2026-09-22', amount:100, description:'Child Benefit', incomeType:'Child Benefit', receivedBy:'p2', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
      normaliseIncomeRecord({ id:'cm', date:'2026-09-11', amount:300, description:'Child Maintenance', incomeType:'Child Maintenance', receivedBy:'p2', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
      normaliseIncomeRecord({ id:'pay1', date:'2026-09-01', amount:2500, description:'Paycheck', incomeType:'Employment', receivedBy:'p1', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
      normaliseIncomeRecord({ id:'uc', date:'2026-09-05', amount:1200, description:'Universal Credit', incomeType:'Benefits', receivedBy:'p2', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
      normaliseIncomeRecord({ id:'reward', date:'2026-09-15', amount:50, description:'One off reward', incomeType:'Reward', receivedBy:'p1', account:'legacy-bank', confirmationIssues:[] }, '2026-09'),
    ],
    '2026-10': [
      normaliseIncomeRecord({ id:'oct-income-p1', date:'2026-10-01', amount:100, description:'Expected source 1', incomeType:'Other income', receivedBy:'p1', account:'legacy-bank', confirmationIssues:[] }, '2026-10'),
      normaliseIncomeRecord({ id:'oct-income-p2', date:'2026-10-02', amount:200, description:'Expected source 2', incomeType:'Other income', receivedBy:'p2', account:'legacy-bank', confirmationIssues:[] }, '2026-10'),
    ],
  },
  bankBalancesByMonth: { '2026-10': [{ id:'legacy-bank', label:'Bank', balance:50, ownerId:'unassigned', ownerLabel:'' }] },
};

const ambiguousSummary = monthSummary(base, '2026-10');
assert.equal(ambiguousSummary.accountFundingPlan.length, 1);
assert.equal(ambiguousSummary.accountFundingPlan[0].ambiguousAccount, true);
assert.equal(ambiguousSummary.hasAmbiguousFundingAccounts, true);
assert.equal(ambiguousSummary.totalTransferNeeded, null);

let counter = 0;
const splitPlan = buildMonthAccountSplitPlan(base, '2026-10', 'legacy-bank', () => `new-${++counter}`);
assert.equal(splitPlan.mappings.length, 2);
const split = appReducer(base, { type:'SPLIT_ACCOUNT_FOR_MONTH', monthKey:'2026-10', sourceAccountId:'legacy-bank', sourceAccountLabel:'Bank', mappings:splitPlan.mappings, peopleLabels:{p1:'Person 1',p2:'Person 2'}, auditAt:'2026-09-30T12:00:00Z' });
assert.equal(split.txnsByMonth['2026-09'].every((row) => row.account === 'legacy-bank'), true, 'Historical month must not be rewritten.');
assert.equal(new Set(split.txnsByMonth['2026-10'].map((row) => row.account)).size, 2, 'Current month must use two distinct account IDs.');
assert.equal(new Set(split.incomeByMonth['2026-10'].map((row) => row.account)).size, 2, 'Current-month income must follow the explicitly approved Received By owner mapping.');
assert.equal(base.incomeByMonth['2026-09'].every((row) => row.account === 'legacy-bank'), true, 'Historical income must not be rewritten by a current-month account split.');
assert.equal(split.bankBalancesByMonth['2026-10'], undefined, 'Combined current-month balance must be cleared after split.');
assert.equal(monthSummary(split, '2026-10').accountFundingPlan.length, 2);

assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][0]), 'fixed');
assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][1]), 'fixed');
assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][2]), 'confirm');
assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][3]), 'confirm');
assert.equal(recurringIncomeMode(base.incomeByMonth['2026-09'][4]), 'manual');

const cleanTarget = { ...base, txnsByMonth:{...base.txnsByMonth, '2026-10':[]}, incomeByMonth:{...base.incomeByMonth, '2026-10':[]} };
const setup = recurringBillSetup(cleanTarget, '2026-10');
assert.equal(setup.availableCount, 2);
assert.equal(setup.availableIncomeCount, 4, 'One-off reward must not copy.');
const copies = buildMonthSetupCopies(cleanTarget, '2026-10', { billIds: setup.candidates.map((x)=>x.id), incomeIds: setup.incomeCandidates.map((x)=>x.id) }, (prefix)=>`${prefix}-${++counter}`);
assert.equal(copies.bills.length, 2);
assert.equal(copies.income.length, 4);
const childBenefit = copies.income.find((row)=>row.description === 'Child Benefit');
const pay = copies.income.find((row)=>row.description === 'Paycheck');
assert.equal(childBenefit.amount, 100);
assert.equal(childBenefit.amountConfirmed, true);
assert.equal(childBenefit.incomeStatus, 'expected');
assert.equal(pay.amount, 0);
assert.equal(pay.amountConfirmed, false);
assert.equal(pay.confirmationIssues.includes('amount'), true);

const started = appReducer(cleanTarget, { type:'START_NEW_MONTH', monthKey:'2026-10', sourceMonthKey:'2026-09', bills:copies.bills, income:copies.income, auditAt:'2026-09-30T12:00:00Z' });
assert.equal(started.incomeByMonth['2026-10'].length, 4);
assert.deepEqual(started.budgetsByMonth['2026-10'], { household:800 });
const summary = monthSummary(started, '2026-10');
assert.equal(summary.income, 400, 'Only fixed expected amounts count until pay/benefits amounts are confirmed.');
assert.equal(summary.expectedIncome, 400);
assert.equal(summary.tbcIncomeCount, 2);

const old = migrateState({ version:9, incomeByMonth:{'2026-08':[{id:'old',date:'2026-08-01',amount:1000,description:'Legacy pay',incomeType:'Employment',receivedBy:'p1',account:'legacy-bank'}]}, people:[p1], accounts:[ambiguous] }, new Date(2026,7,1));
assert.equal(old.version, 10);
assert.equal(old.incomeByMonth['2026-08'][0].amountConfirmed, true);
assert.equal(old.incomeByMonth['2026-08'][0].incomeStatus, 'received');

console.log('Penny owner-specific account and regular-income carry-forward tests passed');
