import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankState } from '../src/finance.js';
import { appReducer } from '../src/state.js';

const app = await readFile('src/App.jsx', 'utf8');
const css = await readFile('src/add-hub-v93.css', 'utf8');
const main = await readFile('src/main.jsx', 'utf8');

assert.match(app, /PENNY_V93_PURE_SETTINGS_ADD_HUB/, 'v93 marker must be present after postinstall');
assert.match(app, /onClick=\{\(\) => openRecord\(\{ mode: 'people' \}\)\}/, 'Header + Add must open on People');

const firstTabsStart = app.indexOf('<div className="tabs record-tabs" role="tablist" aria-label="Add type">');
assert.ok(firstTabsStart >= 0, 'Four-tab Add hub must be present');
const firstTabsEnd = app.indexOf('</div>', firstTabsStart);
const firstTabs = app.slice(firstTabsStart, firstTabsEnd);
const positions = ['>People</button>', '>Accounts</button>', '>Income</button>', '>Expense</button>'].map((token) => firstTabs.indexOf(token));
assert.ok(positions.every((position) => position >= 0), 'Add hub must contain People, Accounts, Income and Expense');
assert.ok(positions.every((position, index) => index === 0 || position > positions[index - 1]), 'Add hub order must be People, Accounts, Income, Expense');

assert.match(app, /mode === 'people'/, 'People must be a first-class Add mode');
assert.match(app, /field: 'people'/, 'People created in + Add must remain month-scoped');
assert.match(app, /field: 'accounts'/, 'Debit and credit accounts created in + Add must remain month-scoped');
assert.match(app, /type: 'SET_SAVINGS_ACCOUNTS'/, 'Savings accounts created in + Add must continue using the month savings snapshot');
assert.match(app, /Debit \/ current account[\s\S]*Credit card[\s\S]*Savings account/, 'Accounts must support debit/current, credit card and savings types');
assert.match(app, /People added here belong to the selected month/, 'People tab must explain selected-month scope');
assert.match(app, /Settings is no longer used to record people or accounts/, 'Accounts tab must explain the new ownership of setup flow');
assert.doesNotMatch(app, /Advanced account management in Settings/, 'Add hub must not send users back to Settings for account recording');

const settingsStart = app.indexOf('function SettingsModal(');
assert.ok(settingsStart >= 0, 'SettingsModal must remain');
const settingsEnd = app.indexOf('\nfunction ', settingsStart + 20);
const settings = app.slice(settingsStart, settingsEnd > settingsStart ? settingsEnd : app.length);
assert.doesNotMatch(settings, /<h3>Household People<\/h3>/, 'Settings must not record household people');
assert.doesNotMatch(settings, /<h3>Accounts<\/h3>/, 'Settings must not record bank/card accounts');
assert.doesNotMatch(settings, /<h3>Savings Accounts<\/h3>/, 'Settings must not record savings account definitions');
assert.doesNotMatch(settings, /<ReferenceEditor field="people"/, 'Settings must not expose the people reference editor');
assert.doesNotMatch(settings, /<ReferenceEditor field="accounts"/, 'Settings must not expose the accounts reference editor');
for (const heading of ['Categories', 'Backup and Recovery']) {
  assert.ok(settings.includes(heading), `Settings must retain ${heading}`);
}

assert.match(main, /import '\.\/add-hub-v93\.css';/, 'v93 styles must load after v92 styles');
assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/, 'Four Add tabs must fit in one row');

// Month-scoped reference storage remains intact after moving UI ownership.
let state = createBlankState();
state = appReducer(state, {
  type: 'SET_MONTH_REFERENCE_LIST',
  monthKey: '2026-10',
  field: 'people',
  items: [{ id: 'p1', label: 'Person One' }],
  audit: false,
});
state = appReducer(state, {
  type: 'SET_MONTH_REFERENCE_LIST',
  monthKey: '2026-10',
  field: 'accounts',
  items: [{ id: 'a1', label: 'Current Account', ownerId: 'p1', accountType: 'debit' }],
  audit: false,
});
assert.equal(state.peopleByMonth['2026-10'][0].label, 'Person One');
assert.equal(state.accountsByMonth['2026-10'][0].ownerId, 'p1');

console.log('v93 pure Settings and People/Accounts/Income/Expense Add hub regression passed');
