import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');
const v45 = await readFile('scripts/apply-v45-clean-slate.mjs', 'utf8');
const v85 = await readFile('scripts/apply-v85-critical-testing-fixes.mjs', 'utf8');

// Primary blocker: Income and Expense share visible Description + Amount inputs.
assert.match(app, /htmlFor="record-description">Description<\/label>[\s\S]{0,250}id="record-description"/, 'Record editor must visibly expose Description.');
assert.match(app, /htmlFor="record-amount">Amount<\/label>[\s\S]{0,250}id="record-amount"/, 'Record editor must visibly expose Amount.');
assert.match(app, /if \(!description\.trim\(\)\)[\s\S]{0,100}Description is required/, 'Description validation must remain connected to the visible Description field.');
assert.match(v45, /shared Description\/Amount fields were removed/, 'Clean-slate transform must guard shared record fields.');

// Savings message follows what is actually displayed for the selected month.
assert.match(app, /!displayedSavingsAccounts\.length && <div className="empty savings-settings-hint">Add savings accounts in Settings first\.<\/div>/, 'Savings setup hint must only show when no monthly savings accounts are displayed.');
assert.doesNotMatch(app, /!masterSavingsAccounts\.length && <div className="empty savings-settings-hint"/, 'Savings hint must not use the obsolete global master list.');

// Explicit month choices survive release-triggered same-tab reloads.
assert.match(app, /sessionStorage\?\.getItem\('penny_explicit_month'\)/, 'Explicit selected month must be restorable after a release reload.');
assert.match(app, /sessionStorage\?\.setItem\('penny_explicit_month', value\)/, 'Explicit month selection must be persisted for the current tab session.');
assert.match(app, /followCurrentPeriodRef = useRef\(!initialExplicitMonth\)/, 'A restored explicit month must not immediately snap back to the current month.');

// Export remains alive long enough for browsers to start the download.
assert.match(app, /anchor\.click\(\);[\s\S]{0,180}setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 1500\)/, 'Backup URL must not be revoked synchronously.');
assert.match(app, /setToast\('Backup download started\.'\)/, 'Backup export must provide a visible confirmation.');

// Account controls are uniquely named for assistive technology.
assert.match(app, /aria-label="New account name"/, 'New account field must have a distinct accessible name.');
assert.match(app, /aria-label=\{item\.label \+ ' account name'\}/, 'Existing account name fields must identify the account they edit.');
assert.match(app, /aria-label="New account owner"/, 'New account owner field must be distinct from existing account owner controls.');

// Previously fixed v84 requirements remain intact.
assert.match(app, /function AssignmentSelect\(/, 'Inline User/Account assignment dropdowns must remain installed.');
assert.match(app, /onAssignTransaction=\{assignExpenseReference\}/, 'Expense inline assignments must remain direct-edit controls.');
assert.match(app, /onAssignIncome=\{assignIncomeReference\}/, 'Income inline assignments must remain direct-edit controls.');
assert.match(v85, /PENNY_V85_EXPLICIT_MONTH_SESSION/, 'v85 final transform marker must be present.');

console.log('v85 critical tester regression checks passed');
