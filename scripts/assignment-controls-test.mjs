import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');
const styles = await readFile('src/styles.css', 'utf8');
const releasePatch = await readFile('scripts/apply-v84-final.mjs', 'utf8');

assert.match(app, /function AssignmentSelect\(/, 'Cards must share one inline assignment dropdown implementation.');
assert.match(app, /Paid by <AssignmentSelect[\s\S]*placeholder="User"/, 'Expense cards must identify the payer field directly.');
assert.match(app, /Received by <AssignmentSelect[\s\S]*placeholder="User"/, 'Income cards must identify the recipient field directly.');
assert.match(app, /placeholder="Account"/, 'Missing account controls must identify themselves as Account.');
assert.match(app, /onAssignTransaction=\{assignExpenseReference\}/, 'Expense assignment controls must save directly from the card.');
assert.match(app, /onAssignIncome=\{assignIncomeReference\}/, 'Income assignment controls must save directly from the card.');
assert.match(app, /aria-label=\{'Select ' \+ fieldLabel\}/, 'Inline assignment dropdowns must have accessible field labels.');
assert.match(app, /<RecordBadges record=\{record\} compact \/>/, 'Income confirmation summary chip must remain.');
assert.match(app, /<RecordBadges record=\{transaction\} compact \/>/, 'Expense confirmation summary chip must remain.');
assert.match(styles, /\.assignment-select\.is-unassigned[\s\S]*var\(--amber\)/, 'Unassigned dropdowns must retain the existing yellow warning colour.');
assert.match(releasePatch, /PENNY_V84_INLINE_ASSIGNMENT/, 'The release patch must install direct inline assignment handling.');
assert.match(releasePatch, /PENNY_V84_ROLLOVER_REFERENCES/, 'The release patch must preserve valid month rollover references.');

console.log('Assignment control regression checks passed.');
