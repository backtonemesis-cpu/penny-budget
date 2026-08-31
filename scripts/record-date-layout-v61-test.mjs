import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformRecordDateLayout } from '../build/record-date-layout.js';

const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const transformed = transformRecordDateLayout(source);
const start = transformed.indexOf('function RecordModal(');
const end = transformed.indexOf('\nfunction ReferenceSelect(', start);
const modal = transformed.slice(start, end);

assert.ok(start >= 0 && end > start, 'RecordModal must be present');
assert.equal((modal.match(/id="record-date"/g) || []).length, 3, 'Expense, income and transfer must each render one Exact date control');
assert.equal((modal.match(/Exact date not confirmed/g) || []).length, 0, 'Exact date must use a blank optional field rather than a second TBC checkbox');
assert.doesNotMatch(modal, /disabled=\{!dateConfirmed\}/, 'Blank date fields must remain directly editable.');

const expenseStart = modal.indexOf("{mode === 'expense' && (");
const expenseCategory = modal.indexOf('<label htmlFor="record-category">Category</label>', expenseStart);
const expenseDate = modal.indexOf('<label htmlFor="record-date">Exact date</label>', expenseCategory);
const expenseType = modal.indexOf('<legend>Expense type</legend>', expenseDate);
assert.ok(expenseStart >= 0 && expenseCategory > expenseStart && expenseDate > expenseCategory && expenseType > expenseDate,
  'Expense Exact date must be directly after Category and before Expense type');

const incomeStart = modal.indexOf("{mode === 'income' && (");
const incomeDate = modal.indexOf('<label htmlFor="record-date">Exact date</label>', incomeStart);
const receivedAccount = modal.indexOf('label="Received into account"', incomeDate);
assert.ok(incomeStart >= 0 && incomeDate > incomeStart && receivedAccount > incomeDate,
  'Income Exact date must be before Received into account');

const movementStart = modal.indexOf("{mode === 'movement' && (");
const movementDate = modal.indexOf('<label htmlFor="record-date">Exact date</label>', movementStart);
assert.ok(movementStart >= 0 && movementDate > movementStart, 'Transfer mode must retain Exact date controls');

assert.ok(!transformed.includes("installExactDateAction"), 'Compiled App source must not depend on the removed DOM date workaround');

console.log('Record date layout checks passed.');
