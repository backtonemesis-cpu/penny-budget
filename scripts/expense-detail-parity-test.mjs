import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [driver, v32Driver] = await Promise.all([
  readFile('scripts/apply-v35-expense-detail.mjs', 'utf8'),
  readFile('scripts/apply-v32-expense-navigation.mjs', 'utf8'),
]);

assert.match(v32Driver, /onExpenseDetails=\{\(\) => setView\('Transactions'\)\} \/\/ PENNY_V32_EXPENSE_DETAIL/, 'Regression fixture: v32 installs the legacy Transactions route.');
assert.match(driver, /onExpenseDetails=\{\(\) => setView\('Transactions'\)\} \/\/ PENNY_V32_EXPENSE_DETAIL/, 'v35 must explicitly recognise the real v32 legacy route.');
assert.match(driver, /onExpenseDetails=\{\(\) => setView\('Expenses'\)\} \/\/ PENNY_V35_EXPENSE_DETAIL/, 'Overview Expenses must be rewritten to the dedicated Expense Detail view.');
assert.match(driver, /legacyExpenseRoutes\.some/, 'Build must fail if a legacy Expenses-to-Transactions route survives.');
assert.match(driver, /function ExpenseDetail\(/, 'A dedicated Expense Detail component must be installed.');
assert.match(driver, /\{view === 'Expenses' && \(/, 'The dedicated Expenses view must be rendered by App.');
assert.match(driver, /income-detail-row expense-detail-row/, 'Expense Detail rows must reuse the Income Detail layout structure.');
assert.match(driver, /Paid by:/, 'Expense Detail must show who paid each expense.');
assert.match(driver, /Account:/, 'Expense Detail must show the paying account.');
assert.match(driver, /Recorded expense total/, 'Expense Detail must reconcile to the Overview expense total.');
assert.match(driver, /Mark unpaid/, 'Expense Detail must retain payment-status actions.');
assert.match(driver, /Edit/, 'Expense Detail must retain edit access.');
assert.match(driver, /Delete/, 'Expense Detail must retain delete access.');

console.log('Expense detail routing and parity regression passed');
