import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');
const css = await readFile('src/add-hub-v94.css', 'utf8');
const main = await readFile('src/main.jsx', 'utf8');

assert.match(app, /PENNY_V94_UNIFORM_ADD_MENU/, 'v94 marker must be present after postinstall');
assert.match(app, /onClick=\{\(\) => openRecord\(\{ mode: 'menu' \}\)\}/, 'Header + Add must open the chooser first');
assert.match(app, /mode === 'menu'/, 'Record modal must have a chooser mode');
assert.match(app, /aria-label="Choose what to add"/, 'Chooser must be explicitly labelled');
for (const label of ['People', 'Accounts', 'Income', 'Expense']) {
  assert.match(app, new RegExp(`<strong>${label}<\\/strong>`), `Chooser must include ${label}`);
}

assert.doesNotMatch(app, /title="Add people" onClose=\{onClose\} initialFocusId="add-person-name"/, 'People must not auto-focus the name field');
assert.doesNotMatch(app, /title="Add account" onClose=\{onClose\} initialFocusId="add-account-name"/, 'Accounts must not auto-focus the name field');
assert.match(app, /<SimpleModal title="Add people" onClose=\{onClose\} wide>/, 'People must use the wide Add layout');
assert.match(app, /<SimpleModal title="Add account" onClose=\{onClose\} wide>/, 'Accounts must use the wide Add layout');
assert.match(app, /mode === 'income' \? 'Add income' : mode === 'expense' \? 'Add expense'/, 'Income and Expense must use matching Add titles');
assert.match(app, /wide=\{!lockedMode\}/, 'New Income and Expense forms must use the same wide layout');

const settingsStart = app.indexOf('function SettingsModal(');
assert.ok(settingsStart >= 0, 'SettingsModal must remain present');
const settingsEnd = app.indexOf('\nfunction ', settingsStart + 20);
const settings = app.slice(settingsStart, settingsEnd > settingsStart ? settingsEnd : app.length);
assert.doesNotMatch(settings, /<MonthSavingsSettings/, 'Settings must not render Savings Accounts setup');
assert.doesNotMatch(settings, /<ReferenceEditor field="people"/, 'Settings must not render People setup');
assert.doesNotMatch(settings, /<ReferenceEditor field="accounts"/, 'Settings must not render Account setup');
assert.match(settings, /Categories/, 'Settings must retain Categories');
assert.match(settings, /Backup and Recovery/, 'Settings must retain Backup and Recovery');

assert.match(main, /import '\.\/add-hub-v94\.css';/, 'v94 CSS must load after the previous Add styles');
assert.match(css, /\.add-menu-grid \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'Desktop chooser must use large menu cards');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.add-menu-grid \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, 'Mobile chooser must use full-width stacked menu cards');
assert.match(css, /\.record-tabs \{[\s\S]*width: 100%/, 'Section navigation must span the Add modal width');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.record-tabs \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'Mobile section navigation must use roomy 2x2 buttons');
assert.match(css, /\.quick-setup-wrap,[\s\S]*\.quick-setup-actions \{[\s\S]*display: none !important;/, 'Cross-entry People/Account shortcuts must not appear inside other Add areas');

console.log('v94 uniform Add chooser, no-autofocus flow and Settings-only regression passed');
