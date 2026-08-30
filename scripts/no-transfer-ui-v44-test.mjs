import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');

assert.doesNotMatch(app, /Transfers & excluded movements/, 'Transactions must not render the transfers/excluded movements disclosure');
assert.doesNotMatch(app, /setKind\('transfer'\)/, 'Add Record must not expose a Transfer tab');
assert.doesNotMatch(app, />Transfer<\/button>/, 'Transfer must not appear as an Add Record tab');
assert.match(app, /const removeAccount = \(id\) =>/, 'Savings must retain month-scoped snapshot removal logic');
assert.match(app, /onRemove=\{\(\) => removeAccount\(account\.id\)\}/, 'Savings rows must expose month-only removal');
assert.match(app, /className="danger-button" onClick=\{onRemove\}>Delete<\/button>/, 'Savings rows must include Delete beside edit controls');

console.log('v44 no-transfer UI and Savings delete regression passed');
