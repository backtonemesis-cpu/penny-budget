import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CURRENT_STATE_VERSION, migrateState } from '../src/finance.js';

const app = await readFile('src/App.jsx', 'utf8');

assert.match(app, /PENNY_V95_CLEAN_ADD_FLOW/, 'v95 marker must be present');
assert.match(app, /onClick=\{\(\) => openRecord\(\{ mode: 'people' \}\)\}/, '+ Add must open the four-tab workspace directly on People');
assert.doesNotMatch(app, /mode === 'menu'/, 'No intermediate Add chooser mode should remain');
assert.doesNotMatch(app, /aria-label="Choose what to add"/, 'No extra chooser menu should remain');
assert.doesNotMatch(app, /title="Add people" onClose=\{onClose\} initialFocusId=/, 'People must not auto-focus or summon the keyboard');
assert.match(app, /<SimpleModal title="Add people" onClose=\{onClose\} wide>/, 'People must use the wide Add workspace');

assert.match(app, /<label htmlFor="add-person-name">Person name<\/label>\s*<input id="add-person-name"[^>]*\/>/s, 'People name input must remain available');
assert.doesNotMatch(app, /id="add-person-name"[^>]*placeholder=/, 'People name input must be visually blank');
assert.doesNotMatch(app, /added to this month\.<\/div>/, 'People success confirmation banner must not be rendered');

assert.match(app, /<label htmlFor="add-account-name">Bank account name<\/label>/, 'Account name must use the requested Bank account name label');
assert.doesNotMatch(app, /id="add-account-name"[^>]*placeholder=/, 'Bank account name must be visually blank');
assert.match(app, /const \[accountTypeDraft, setAccountTypeDraft\] = useState\(''\)/, 'Account type must start blank');
assert.match(app, /const \[accountOwnerDraft, setAccountOwnerDraft\] = useState\(''\)/, 'Account owner must start blank');
assert.match(app, /<option value="">Select account type<\/option>\s*<option value="debit">Debit<\/option>\s*<option value="credit">Credit card<\/option>\s*<option value="savings">Savings account<\/option>/s, 'Account type choices must be blank-first and simplified');
assert.match(app, /id="add-account-owner"[\s\S]*?<option value="">Select owner<\/option>/, 'Owner must be blank-first');
const accountStart = app.indexOf("if (!lockedMode && mode === 'account')");
const accountEnd = app.indexOf('  const save = () => {', accountStart);
const accountBlock = app.slice(accountStart, accountEnd);
assert.doesNotMatch(accountBlock, /\+ Add person/, 'Accounts must not contain a People creation shortcut');

assert.match(app, /<label htmlFor="record-description">\{mode === 'income' \? 'Income type' : 'Description'\}<\/label>/, 'Income must reuse one text field labelled Income type');
assert.doesNotMatch(app, /id="record-description"[^>]*placeholder=/, 'Income/Expense text entry must be visually blank');
assert.doesNotMatch(app, /id="record-amount"[^>]*placeholder=/, 'Amount entry must be visually blank');
assert.doesNotMatch(app, /id="income-type"/, 'The duplicate Income type field must be removed');
assert.match(app, /incomeType: description,/, 'The single Income type text must populate the underlying income type safely');
assert.doesNotMatch(app, /\{renderQuickSetup\(\)\}/, 'Income and Expense must not contain cross-entry quick setup');
assert.doesNotMatch(app, /Manage people, accounts and categories in Settings/, 'Income/Expense must not route account creation back to Settings');

const settingsStart = app.indexOf('function SettingsModal(');
const settingsEnd = app.indexOf('\nfunction ', settingsStart + 20);
const settings = app.slice(settingsStart, settingsEnd > settingsStart ? settingsEnd : app.length);
for (const forbidden of ['<MonthSavingsSettings', '<ReferenceEditor field="people"', '<ReferenceEditor field="accounts"', '<ReferenceEditor field="savingsAccounts"']) {
  assert.doesNotMatch(settings, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Settings must not contain data-entry control ${forbidden}`);
}
assert.match(app, /Add them through \+ Add → Accounts\./, 'Savings empty state must point to + Add Accounts, not Settings');

const resetLikeState = {
  version: CURRENT_STATE_VERSION,
  txnsByMonth: {},
  incomeByMonth: {},
  customCats: [],
  hiddenCats: [],
  people: [],
  accounts: [],
  savingsAccounts: [
    { id: 'saving_chase', label: 'Chase' },
    { id: 'saving_santander', label: 'Santander' },
    { id: 'saving_cash', label: 'Cash' },
  ],
  savingsByMonth: {},
  bankBalancesByMonth: {},
  monthMetaByMonth: {},
  budgetsByMonth: {},
  dueDays: {},
  auditLog: [],
};
const migrated = migrateState(resetLikeState, new Date(2026, 7, 31, 12, 0, 0));
assert.deepEqual(migrated.savingsByMonth, {}, 'A current-format blank month must not recreate Chase/Santander/Cash from the legacy master list');

console.log('v95 clean Add workflow, blank fields and blank-month savings regressions passed');
