import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');
const styles = await readFile('src/styles.css', 'utf8');
const releasePatch = await readFile('scripts/apply-v77-assignment-controls.mjs', 'utf8');

assert.match(app, /function AssignmentValue\(/, 'Cards must share one assignment control implementation.');
assert.match(app, /onEditIncome\(record, 'receivedBy'\)/, 'Missing income recipient must open the recipient assignment field.');
assert.match(app, /onEditIncome\(record, 'account'\)/, 'Missing income account must open the account assignment field.');
assert.match(app, /onEdit\(transaction, 'paidBy'\)/, 'Missing expense payer must open the payer assignment field.');
assert.match(app, /onEdit\(transaction, 'account'\)/, 'Missing expense account must open the account assignment field.');
assert.match(app, /if \(!unassigned\) return <span>\{value\}<\/span>/, 'Assigned values must remain normal text.');
assert.match(app, /className="assignment-warning"[^>]*aria-label=\{`Assign \$\{fieldLabel\}`\}/, 'Unassigned values must be accessible buttons.');
assert.match(app, /initialFocusId=\{\{ paidBy: 'record-paid-by', receivedBy: 'income-received-by', account:/, 'Assignment buttons must focus the matching existing editor field.');
assert.match(app, /<RecordBadges record=\{record\} compact \/>/, 'Income confirmation summary chip must remain.');
assert.match(app, /<RecordBadges record=\{transaction\} compact \/>/, 'Expense confirmation summary chip must remain.');
assert.match(styles, /\.assignment-warning[\s\S]*var\(--amber\)/, 'Unassigned controls must use the existing yellow warning colour.');
assert.match(releasePatch, /onEdit\(record, 'receivedBy'\)/, 'The generated Income Detail card must receive the same field-specific control.');
assert.match(releasePatch, /onEdit\(transaction, \\'paidBy\\'\)/, 'The generated Expense Detail card must receive the same field-specific control.');
assert.match(releasePatch, /Income Detail must expose an actionable recipient assignment/, 'The generated finance-source audit must check the new control instead of obsolete static text.');

console.log('Assignment control regression checks passed.');

