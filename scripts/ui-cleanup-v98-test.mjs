import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');
const layout = await readFile('build/record-date-layout.js', 'utf8');
const styles = await readFile('src/styles.css', 'utf8');

assert.match(app, /PENNY_V98_UI_CLEANUP/, 'v98 marker must be present after postinstall');
assert.match(app, /label="Paid from account"/, 'Expense editor must use one payment account selector');
assert.match(app, /label="Received into account"/, 'Income editor must use one receiving account selector');
assert.doesNotMatch(app, /<ReferenceSelect id="record-paid-by"/, 'Expense editor must not render a separate payer selector');
assert.doesNotMatch(app, /<ReferenceSelect id="income-received-by"/, 'Income editor must not render a separate recipient selector');
assert.match(app, /fieldLabel="Paid from account"/, 'Expense card must use one payment account assignment control');
assert.match(app, /fieldLabel="Received into account"/, 'Income card must use one receiving account assignment control');
assert.match(app, /draft\.paidBy = ownerId/, 'Expense payer must be derived from account owner');
assert.match(app, /draft\.receivedBy = ownerId/, 'Income recipient must be derived from account owner');
assert.match(app, /<option value="" disabled hidden><\/option>/, 'Account type blank placeholder must not be selectable');
assert.match(app, /<option value="debit">Debit<\/option>/, 'Debit account choice must be concise');
assert.match(app, /<option value="credit">Credit<\/option>/, 'Credit account choice must be concise');
assert.match(app, /<option value="savings">Savings<\/option>/, 'Savings account choice must be concise');
assert.doesNotMatch(app, /Exact date not confirmed/, 'Record editors must not render the redundant date-TBC checkbox');
assert.match(layout, /Expected no Exact date TBC checkbox controls/, 'Build-time date layout must enforce the simplified date UI');
assert.match(app, /filter\(\(issue\) => issue !== 'received'\)/, 'Expected income must not show a duplicate receipt-status TBC badge');
assert.match(app, /type="text" inputMode="decimal" value=\{balance\}/, 'Savings balance must be direct decimal text entry without number spinners');
assert.match(styles, /\.savings-detail-row \+ \.total-line \{ border-top: 0; \}/, 'Savings detail must not render a double divider before the snapshot total');

console.log('v98 UI cleanup regression passed');
