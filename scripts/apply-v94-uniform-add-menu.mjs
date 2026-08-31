import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

function replaceRequired(before, after, label) {
  if (app.includes(after)) return;
  if (!app.includes(before)) throw new Error('v94 missing anchor: ' + label);
  app = app.replace(before, after);
}

function removeRequired(block, label) {
  if (!app.includes(block)) throw new Error('v94 missing block: ' + label);
  app = app.replace(block, '');
}

// + Add is now a chooser first. It must never jump straight into a field or
// summon the iPhone keyboard before the user chooses what they want to add.
replaceRequired(
  `            onClick={() => openRecord({ mode: 'people' })}`,
  `            onClick={() => openRecord({ mode: 'menu' })}`,
  'header Add opens chooser',
);

const menuMode = `  if (!lockedMode && mode === 'menu') {\n    const chooseAddMode = (nextMode) => {\n      setFormError('');\n      setSetupError('');\n      setSetupNotice('');\n      setQuickAdd(null);\n      setMode(nextMode);\n    };\n    return (\n      <SimpleModal title="Add" onClose={onClose} wide>\n        <div className="add-menu-grid" role="group" aria-label="Choose what to add">\n          <button type="button" className="add-menu-card" onClick={() => chooseAddMode('people')}>\n            <strong>People</strong>\n            <span>Add or review household people</span>\n          </button>\n          <button type="button" className="add-menu-card" onClick={() => chooseAddMode('account')}>\n            <strong>Accounts</strong>\n            <span>Add bank, card or savings accounts</span>\n          </button>\n          <button type="button" className="add-menu-card" onClick={() => chooseAddMode('income')}>\n            <strong>Income</strong>\n            <span>Record money coming in</span>\n          </button>\n          <button type="button" className="add-menu-card" onClick={() => chooseAddMode('expense')}>\n            <strong>Expense</strong>\n            <span>Record bills or spending</span>\n          </button>\n        </div>\n      </SimpleModal>\n    );\n  }\n\n`;

if (!app.includes("mode === 'menu'")) {
  const peopleAnchor = `  if (!lockedMode && mode === 'people') {`;
  if (!app.includes(peopleAnchor)) throw new Error('v94 missing People mode anchor');
  app = app.replace(peopleAnchor, menuMode + peopleAnchor);
}

// Selecting a section may show its form, but no field is auto-focused. This
// keeps the keyboard closed until the user deliberately taps a field.
replaceRequired(
  `<SimpleModal title="Add people" onClose={onClose} initialFocusId="add-person-name">`,
  `<SimpleModal title="Add people" onClose={onClose} wide>`,
  'People modal no autofocus and wide layout',
);
replaceRequired(
  `<SimpleModal title="Add account" onClose={onClose} initialFocusId="add-account-name">`,
  `<SimpleModal title="Add account" onClose={onClose} wide>`,
  'Accounts modal no autofocus and wide layout',
);
replaceRequired(
  `<SimpleModal title={existing ? 'Edit record' : 'Add record'} onClose={onClose} initialFocusId={{ paidBy: 'record-paid-by', receivedBy: 'income-received-by', account: mode === 'income' ? 'income-account' : 'record-account' }[focusField]}>`,
  `<SimpleModal title={existing ? 'Edit record' : mode === 'income' ? 'Add income' : mode === 'expense' ? 'Add expense' : 'Add record'} onClose={onClose} wide={!lockedMode} initialFocusId={{ paidBy: 'record-paid-by', receivedBy: 'income-received-by', account: mode === 'income' ? 'income-account' : 'record-account' }[focusField]}>`,
  'Income and Expense use matching wide Add layout',
);

// Settings must be settings-only. v82 renders Savings Accounts through a child
// component, so the v93 heading-based removal could not see it. Remove the
// actual rendered child section explicitly while leaving the underlying monthly
// savings data and Savings page untouched.
const monthSavingsSettingsSection = `          <section className="settings-section">\n            <MonthSavingsSettings state={state} monthKey={monthKey} mutate={mutate} />\n          </section>\n`;
if (app.includes(monthSavingsSettingsSection)) removeRequired(monthSavingsSettingsSection, 'rendered Savings Accounts Settings section');

const settingsStart = app.indexOf('function SettingsModal(');
const settingsEnd = app.indexOf('\nfunction ', settingsStart + 20);
const settingsBlock = app.slice(settingsStart, settingsEnd > settingsStart ? settingsEnd : app.length);
if (settingsStart < 0) throw new Error('v94 SettingsModal missing');
if (settingsBlock.includes('<MonthSavingsSettings')) throw new Error('v94 Settings still renders Savings Accounts');
if (settingsBlock.includes('<ReferenceEditor field="people"')) throw new Error('v94 Settings still renders People editor');
if (settingsBlock.includes('<ReferenceEditor field="accounts"')) throw new Error('v94 Settings still renders Accounts editor');

if (!app.includes('PENNY_V93_PURE_SETTINGS_ADD_HUB')) throw new Error('v94 requires v93 Add architecture');
app = app.replace('PENNY_V93_PURE_SETTINGS_ADD_HUB', 'PENNY_V93_PURE_SETTINGS_ADD_HUB PENNY_V94_UNIFORM_ADD_MENU');
await writeFile(appPath, app);

// v93 protected the previous direct-to-People entry point. The new regression
// intentionally expects the chooser first while keeping all other v93 checks.
const v93TestPath = 'scripts/pure-settings-add-hub-v93-test.mjs';
let v93Test = await readFile(v93TestPath, 'utf8');
v93Test = v93Test.replace(
  "assert.match(app, /onClick=\\{\\(\\) => openRecord\\(\\{ mode: 'people' \\}\\)\\}/, 'Header + Add must open on People');",
  "assert.match(app, /onClick=\\{\\(\\) => openRecord\\(\\{ mode: 'menu' \\}\\)\\}/, 'Header + Add must open the chooser before any data-entry section');",
);
await writeFile(v93TestPath, v93Test);

// The record-date layout plugin keys off the Add-record modal opening. v94
// changes that opening to the uniform Income/Expense title and wide layout, so
// update only those two transform anchors. The underlying record context/date
// behaviour remains exactly the same.
const recordLayoutPath = 'build/record-date-layout.js';
let recordLayout = await readFile(recordLayoutPath, 'utf8');
const oldRecordOpen = `  const recordModalOpen = "<SimpleModal title={existing ? 'Edit record' : 'Add record'} onClose={onClose} initialFocusId={{ paidBy: 'record-paid-by', receivedBy: 'income-received-by', account: mode === 'income' ? 'income-account' : 'record-account' }[focusField]}>";`;
const newRecordOpen = `  const recordModalOpen = "<SimpleModal title={existing ? 'Edit record' : mode === 'income' ? 'Add income' : mode === 'expense' ? 'Add expense' : 'Add record'} onClose={onClose} wide={!lockedMode} initialFocusId={{ paidBy: 'record-paid-by', receivedBy: 'income-received-by', account: mode === 'income' ? 'income-account' : 'record-account' }[focusField]}>";`;
const oldContextOpen = `  const contextualRecordModalOpen = "<SimpleModal title={existing ? 'Edit record' : 'Add record'} subtitle={recordContext} onClose={onClose} initialFocusId={{ paidBy: 'record-paid-by', receivedBy: 'income-received-by', account: mode === 'income' ? 'income-account' : 'record-account' }[focusField]}>";`;
const newContextOpen = `  const contextualRecordModalOpen = "<SimpleModal title={existing ? 'Edit record' : mode === 'income' ? 'Add income' : mode === 'expense' ? 'Add expense' : 'Add record'} subtitle={recordContext} onClose={onClose} wide={!lockedMode} initialFocusId={{ paidBy: 'record-paid-by', receivedBy: 'income-received-by', account: mode === 'income' ? 'income-account' : 'record-account' }[focusField]}>";`;
if (recordLayout.includes(oldRecordOpen)) recordLayout = recordLayout.replace(oldRecordOpen, newRecordOpen);
if (recordLayout.includes(oldContextOpen)) recordLayout = recordLayout.replace(oldContextOpen, newContextOpen);
if (!recordLayout.includes(newRecordOpen) || !recordLayout.includes(newContextOpen)) throw new Error('v94 could not align record-date layout transform anchors');
await writeFile(recordLayoutPath, recordLayout);

console.log('PENNY_V94 uniform Add chooser and pure Settings applied');
