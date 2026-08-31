import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

function replaceRequired(before, after, label) {
  if (app.includes(after)) return;
  if (!app.includes(before)) throw new Error('v95 missing anchor: ' + label);
  app = app.replace(before, after);
}

replaceRequired(
  `            onClick={() => openRecord({ mode: 'menu' })}`,
  `            onClick={() => openRecord({ mode: 'people' })}`,
  'header Add opens People workspace',
);

const menuStart = app.indexOf(`  if (!lockedMode && mode === 'menu') {`);
if (menuStart >= 0) {
  const peopleStart = app.indexOf(`  if (!lockedMode && mode === 'people') {`, menuStart);
  if (peopleStart < 0) throw new Error('v95 could not locate People mode after chooser');
  app = app.slice(0, menuStart) + app.slice(peopleStart);
}

replaceRequired(
  `      setSetupNotice('“' + person.label + '” added to this month.');`,
  `      setSetupNotice('');`,
  'People add confirmation removal',
);
replaceRequired(
  `<input id="add-person-name" value={quickPersonName} onChange={(event) => { setQuickPersonName(event.target.value); setSetupError(''); setSetupNotice(''); }} placeholder="Name" />`,
  `<input id="add-person-name" value={quickPersonName} onChange={(event) => { setQuickPersonName(event.target.value); setSetupError(''); setSetupNotice(''); }} />`,
  'People blank input',
);
replaceRequired(`        {setupNotice && <div className="setup-notice" role="status">{setupNotice}</div>}\n`, ``, 'People setup notice display');

replaceRequired(`  const [quickAccountType, setQuickAccountType] = useState('debit');`, `  const [quickAccountType, setQuickAccountType] = useState('');`, 'quick account type blank');
replaceRequired(`  const [quickAccountOwner, setQuickAccountOwner] = useState('household');`, `  const [quickAccountOwner, setQuickAccountOwner] = useState('');`, 'quick account owner blank');
replaceRequired(`  const [accountTypeDraft, setAccountTypeDraft] = useState('debit');`, `  const [accountTypeDraft, setAccountTypeDraft] = useState('');`, 'account type blank');
replaceRequired(`  const [accountOwnerDraft, setAccountOwnerDraft] = useState('household');`, `  const [accountOwnerDraft, setAccountOwnerDraft] = useState('');`, 'account owner blank');
replaceRequired(`    setQuickAccountType('debit');`, `    setQuickAccountType('');`, 'quick account type reset blank');
replaceRequired(
  `    setQuickAccountOwner(selectedOwner && selectedOwner !== 'unassigned' ? selectedOwner : 'household');`,
  `    setQuickAccountOwner('');`,
  'quick account owner reset blank',
);
replaceRequired(
  `      setAccountNameDraft('');\n      setSetupNotice(kindLabel + ' “' + nextAccount.label + '” added to this month.');`,
  `      setAccountNameDraft('');\n      setAccountTypeDraft('');\n      setAccountOwnerDraft('');\n      setSetupNotice('');`,
  'Account add reset without confirmation banner',
);
replaceRequired(`<label htmlFor="add-account-name">Account name</label>`, `<label htmlFor="add-account-name">Bank account name</label>`, 'bank account name label');
replaceRequired(
  `<input id="add-account-name" value={accountNameDraft} onChange={(event) => { setAccountNameDraft(event.target.value); if (setupError) setSetupError(''); }} placeholder="Lloyds, Santander, Emergency Fund…" />`,
  `<input id="add-account-name" value={accountNameDraft} onChange={(event) => { setAccountNameDraft(event.target.value); if (setupError) setSetupError(''); }} />`,
  'account name blank input',
);
replaceRequired(
  `<select id="add-account-type" value={accountTypeDraft} onChange={(event) => setAccountTypeDraft(event.target.value)}>\n              <option value="debit">Debit / current account</option>\n              <option value="credit">Credit card</option>\n              <option value="savings">Savings account</option>\n            </select>`,
  `<select id="add-account-type" value={accountTypeDraft} onChange={(event) => { setAccountTypeDraft(event.target.value); if (setupError) setSetupError(''); }}>\n              <option value="">Select account type</option>\n              <option value="debit">Debit</option>\n              <option value="credit">Credit card</option>\n              <option value="savings">Savings account</option>\n            </select>`,
  'account type blank selector',
);
replaceRequired(
  `<ReferenceSelect id="add-account-owner" label="Owner" value={accountOwnerDraft} options={setupOwnerOptions} onChange={setAccountOwnerDraft} />`,
  `<div className="field">\n          <label htmlFor="add-account-owner">Owner</label>\n          <select id="add-account-owner" value={accountOwnerDraft} onChange={(event) => { setAccountOwnerDraft(event.target.value); if (setupError) setSetupError(''); }}>\n            <option value="">Select owner</option>\n            {setupOwnerOptions.map((item) => <option key={item.id} value={item.id}>{item.displayLabel || item.label}</option>)}\n          </select>\n        </div>`,
  'account owner blank selector',
);

const accountModeStart = app.indexOf(`  if (!lockedMode && mode === 'account') {`);
const saveStart = app.indexOf(`  const save = () => {`, accountModeStart);
if (!(accountModeStart >= 0 && saveStart > accountModeStart)) throw new Error('v95 could not isolate Account mode');
let accountBlock = app.slice(accountModeStart, saveStart);
const ownerHelpersStart = accountBlock.indexOf(`    const addOwnerFromHub = () => {`);
const accountReturn = accountBlock.indexOf(`    return (`, ownerHelpersStart);
if (ownerHelpersStart >= 0) {
  if (accountReturn < 0) throw new Error('v95 could not remove Account person helper functions');
  accountBlock = accountBlock.slice(0, ownerHelpersStart) + accountBlock.slice(accountReturn);
}
const quickOwnerUiStart = accountBlock.indexOf(`        <div className="quick-setup-actions">`);
const accountErrorText = `        {setupError && quickAdd !== 'account-owner-person' && <div className="form-error" role="alert">{setupError}</div>}`;
const accountErrorAnchor = accountBlock.indexOf(accountErrorText);
if (quickOwnerUiStart >= 0) {
  if (accountErrorAnchor < 0) throw new Error('v95 could not remove Account + Add person UI');
  accountBlock = accountBlock.slice(0, quickOwnerUiStart)
    + `        {setupError && <div className="form-error" role="alert">{setupError}</div>}`
    + accountBlock.slice(accountErrorAnchor + accountErrorText.length);
}
accountBlock = accountBlock.replace(
  `<button className="primary-button" disabled={!accountNameDraft.trim()} onClick={addAccountFromHub}>Add account</button>`,
  `<button className="primary-button" disabled={!accountNameDraft.trim() || !accountTypeDraft || !accountOwnerDraft} onClick={addAccountFromHub}>Add account</button>`,
);
app = app.slice(0, accountModeStart) + accountBlock + app.slice(saveStart);

// These legacy quick-setup helpers are no longer rendered, but strip their
// explanatory placeholders too so future refactors cannot accidentally expose them.
app = app.replaceAll(' placeholder="Name"', '');
app = app.replaceAll(' placeholder="Lloyds, Santander…"', '');
app = app.replaceAll(`          {renderQuickSetup()}\n`, '');
app = app.replaceAll(`      <button className="text-button" type="button" onClick={onOpenSettings}>Manage people, accounts and categories in Settings</button>\n`, '');

replaceRequired(
  `<label htmlFor="record-description">Description</label>`,
  `<label htmlFor="record-description">{mode === 'income' ? 'Income type' : 'Description'}</label>`,
  'single Income type field label',
);
replaceRequired(
  `<input id="record-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={mode === 'income' ? 'Paycheck, benefit or other source' : 'Bill, merchant or note'} />`,
  `<input id="record-description" value={description} onChange={(event) => setDescription(event.target.value)} />`,
  'blank record text input',
);
replaceRequired(
  `<input id="record-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />`,
  `<input id="record-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />`,
  'blank amount input',
);
replaceRequired(
  `    if (!description.trim()) {\n      setFormError('Description is required.');\n      return;\n    }`,
  `    if (!description.trim()) {\n      setFormError(mode === 'income' ? 'Income type is required.' : 'Description is required.');\n      return;\n    }`,
  'field-specific required message',
);
replaceRequired(
  `    if (mode === 'income') {\n      if (!incomeType.trim()) {\n        setFormError('Income type is required.');\n        return;\n      }`,
  `    if (mode === 'income') {`,
  'remove second Income type validation',
);
replaceRequired(`          incomeType,`, `          incomeType: description,`, 'single Income type storage');

const oldIncomeTypeField = `          <div className="field">\n            <label htmlFor="income-type">Income type</label>\n            <input id="income-type" value={incomeType} onChange={(event) => setIncomeType(event.target.value)} placeholder="Employment, Benefits, Child Benefit…" />\n          </div>\n`;
if (!app.includes(oldIncomeTypeField)) throw new Error('v95 missing separate Income type field');
app = app.replace(oldIncomeTypeField, '');
replaceRequired(
  `<div className="record-meta">{recordDateLabel(record)} · {record.incomeType}</div>`,
  `<div className="record-meta">{recordDateLabel(record)}{record.incomeType && record.incomeType !== record.description ? \` · \${record.incomeType}\` : ''}</div>`,
  'income list duplicate metadata suppression',
);

app = app.replaceAll(
  `No savings accounts are set up for this month. If Savings snapshot was off during month setup, account definitions were intentionally not copied. Add them in Settings.`,
  `No savings accounts are set up for this month. If Savings snapshot was off during month setup, account definitions were intentionally not copied. Add them through + Add → Accounts.`,
);

const settingsStart = app.indexOf('function SettingsModal(');
const settingsEnd = app.indexOf('\nfunction ', settingsStart + 20);
const settingsBlock = app.slice(settingsStart, settingsEnd > settingsStart ? settingsEnd : app.length);
if (settingsStart < 0) throw new Error('v95 SettingsModal missing');
for (const forbidden of ['<MonthSavingsSettings', '<ReferenceEditor field="people"', '<ReferenceEditor field="accounts"', '<ReferenceEditor field="savingsAccounts"']) {
  if (settingsBlock.includes(forbidden)) throw new Error('v95 Settings still records people/accounts: ' + forbidden);
}
if (app.includes(`mode === 'menu'`) || app.includes('aria-label="Choose what to add"')) throw new Error('v95 extra Add chooser still present');
if (app.includes('Paycheck, benefit or other source') || app.includes('Bill, merchant or note')) throw new Error('v95 visible explanatory record placeholders still present');
if (app.includes('Manage people, accounts and categories in Settings')) throw new Error('v95 obsolete Settings link still present');
if (accountBlock.includes('+ Add person')) throw new Error('v95 Account panel still contains + Add person');

if (!app.includes('PENNY_V94_UNIFORM_ADD_MENU')) throw new Error('v95 requires v94 base');
app = app.replace('PENNY_V94_UNIFORM_ADD_MENU', 'PENNY_V94_UNIFORM_ADD_MENU PENNY_V95_CLEAN_ADD_FLOW');
await writeFile(appPath, app);

const financePath = 'src/finance.js';
let finance = await readFile(financePath, 'utf8');
const oldHydration = `const canHydrateLegacySavingsSnapshot = !Number.isFinite(savedVersion) || savedVersion < 12;`;
const newHydration = `const canHydrateLegacySavingsSnapshot = !Number.isFinite(savedVersion) || savedVersion < CURRENT_STATE_VERSION;`;
if (!finance.includes(newHydration)) {
  if (!finance.includes(oldHydration)) throw new Error('v95 missing v87 savings hydration guard');
  finance = finance.replace(oldHydration, newHydration);
}
await writeFile(financePath, finance);

const v93TestPath = 'scripts/pure-settings-add-hub-v93-test.mjs';
let v93Test = await readFile(v93TestPath, 'utf8');
v93Test = v93Test.replace(
  "assert.match(app, /onClick=\\{\\(\\) => openRecord\\(\\{ mode: 'menu' \\}\\)\\}/, 'Header + Add must open the chooser before any data-entry section');",
  "assert.match(app, /onClick=\\{\\(\\) => openRecord\\(\\{ mode: 'people' \\}\\)\\}/, 'Header + Add must open the four-tab workspace on People without an intermediate chooser');",
);
await writeFile(v93TestPath, v93Test);

console.log('PENNY_V95 clean Add workflow and blank-reset savings fix applied');
