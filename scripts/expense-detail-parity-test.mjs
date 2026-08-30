import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const driver = await readFile('scripts/apply-v35-expense-detail.mjs', 'utf8');
assert.match(driver, /setView\('Expenses'\)/, 'Overview Expenses must open the dedicated Expense Detail view.');
assert.match(driver, /function ExpenseDetail\(/, 'A dedicated Expense Detail component must be installed.');
assert.match(driver, /income-detail-row expense-detail-row/, 'Expense Detail rows must reuse the Income Detail layout structure.');
assert.match(driver, /Paid by:/, 'Expense Detail must show who paid each expense.');
assert.match(driver, /Account:/, 'Expense Detail must show the paying account.');
assert.match(driver, /Recorded expense total/, 'Expense Detail must reconcile to the Overview expense total.');
assert.match(driver, /Mark unpaid/, 'Expense Detail must retain payment-status actions.');
assert.match(driver, /Edit/, 'Expense Detail must retain edit access.');
assert.match(driver, /Delete/, 'Expense Detail must retain delete access.');

console.log('Expense detail parity regression passed');
