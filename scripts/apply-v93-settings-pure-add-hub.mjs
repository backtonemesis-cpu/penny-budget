import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

function replaceRequired(before, after, label) {
  if (app.includes(after)) return;
  if (!app.includes(before)) throw new Error('v93 missing anchor: ' + label);
  app = app.replace(before, after);
}

function removeSettingsSection(heading) {
  const settingsStart = app.indexOf('function SettingsModal(');
  if (settingsStart < 0) throw new Error('v93 SettingsModal missing.');
  const nextFunction = app.indexOf('\nfunction ', settingsStart + 20);
  const settingsEnd = nextFunction > settingsStart ? nextFunction : app.length;
  const headingToken = `<h3>${heading}</h3>`;
  const headingIndex = app.indexOf(headingToken, settingsStart);
  if (headingIndex < 0 || headingIndex > settingsEnd) return false;
  const sectionStart = app.lastIndexOf('<section className="settings-section">', headingIndex);
  const sectionEndToken = '</section>';
  const sectionEnd = app.indexOf(sectionEndToken, headingIndex);
  if (sectionStart < settingsStart || sectionEnd < 0 || sectionEnd > settingsEnd) {
    throw new Error('v93 could not isolate Settings section: ' + heading);
  }
  app = app.slice(0, sectionStart) + app.slice(sectionEnd + sectionEndToken.length);
  return true;
}

// The normal Add entry point now starts with foundational setup rather than an expense.
replaceRequired(
  `            onClick={() => openRecord({ mode: 'expense' })}`,
  `            onClick={() => openRecord({ mode: 'people' })}`,
  'header Add starts on People',
);

// Four deliberate Add tabs: People -> Accounts -> Income -> Expense.
const oldTabs = `        <div className="tabs record-tabs" role="tablist" aria-label="Record type">\n          <button role="tab" aria-selected={mode === 'expense'} className={mode === 'expense' ? 'active' : ''} onClick={() => setMode('expense')}>Expense</button>\n          <button role="tab" aria-selected={mode === 'income'} className={mode === 'income' ? 'active' : ''} onClick={() => setMode('income')}>Income</button>\n          <button role="tab" aria-selected={mode === 'account'} className={mode === 'account' ? 'active' : ''} onClick={() => { setFormError(''); setMode('account'); }}>Account</button>\n        </div>`;
const newTabs = `        <div className="tabs record-tabs" role="tablist" aria-label="Add type">\n          <button role="tab" aria-selected={mode === 'people'} className={mode === 'people' ? 'active' : ''} onClick={() => { setFormError(''); setSetupError(''); setMode('people'); }}>People</button>\n          <button role="tab" aria-selected={mode === 'account'} className={mode === 'account' ? 'active' : ''} onClick={() => { setFormError(''); setSetupError(''); setMode('account'); }}>Accounts</button>\n          <button role="tab" aria-selected={mode === 'income'} className={mode === 'income' ? 'active' : ''} onClick={() => setMode('income')}>Income</button>\n          <button role="tab" aria-selected={mode === 'expense'} className={mode === 'expense' ? 'active' : ''} onClick={() => setMode('expense')}>Expense</button>\n        </div>`;
replaceRequired(oldTabs, newTabs, 'main Add tabs');

// Add a reusable setup notice for People/Accounts creation without closing the hub.
replaceRequired(
  `  const [setupError, setSetupError] = useState('');`,
  `  const [setupError, setSetupError] = useState('');\n  const [setupNotice, setSetupNotice] = useState(''); // PENNY_V93_PURE_SETTINGS_ADD_HUB`,
  'setup notice state',
);

// People are now a first-class Add area. Existing people remain visible and unused
// people can be removed safely from the selected standalone month.
const peopleMode = `  if (!lockedMode && mode === 'people') {\n    const currentTxns = state?.txnsByMonth?.[monthKey] || [];\n    const currentIncome = state?.incomeByMonth?.[monthKey] || [];\n    const personInUse = (personId) =>\n      (monthAccounts || []).some((item) => item.ownerId === personId)\n      || currentTxns.some((item) => item.paidBy === personId)\n      || currentIncome.some((item) => item.receivedBy === personId);\n    const addPersonFromHub = () => {\n      setSetupNotice('');\n      const person = createPersonDefinition(quickPersonName);\n      if (!person) return;\n      setQuickPersonName('');\n      setSetupNotice('“' + person.label + '” added to this month.');\n    };\n    const removePersonFromHub = (person) => {\n      if (personInUse(person.id)) return;\n      if (!globalThis.confirm('Remove “' + person.label + '” from this month? Existing financial records are protected; only unused people can be removed here.')) return;\n      mutate({\n        type: 'SET_MONTH_REFERENCE_LIST',\n        monthKey,\n        field: 'people',\n        items: (monthPeople || []).filter((item) => item.id !== person.id),\n        auditLabel: 'Remove ' + person.label + ' from household people for ' + monthKey,\n      });\n      setSetupNotice('“' + person.label + '” removed from this month.');\n    };\n    return (\n      <SimpleModal title="Add people" onClose={onClose} initialFocusId="add-person-name">\n        <div className="tabs record-tabs" role="tablist" aria-label="Add type">\n          <button role="tab" aria-selected className="active">People</button>\n          <button role="tab" aria-selected={false} onClick={() => { setSetupError(''); setSetupNotice(''); setMode('account'); }}>Accounts</button>\n          <button role="tab" aria-selected={false} onClick={() => { setSetupError(''); setSetupNotice(''); setMode('income'); }}>Income</button>\n          <button role="tab" aria-selected={false} onClick={() => { setSetupError(''); setSetupNotice(''); setMode('expense'); }}>Expense</button>\n        </div>\n        <p className="section-note">People added here belong to the selected month and become available immediately in Paid by and Received by.</p>\n        <div className="field">\n          <label htmlFor="add-person-name">Person name</label>\n          <input id="add-person-name" value={quickPersonName} onChange={(event) => { setQuickPersonName(event.target.value); setSetupError(''); setSetupNotice(''); }} placeholder="Name" />\n        </div>\n        {setupError && <div className="form-error" role="alert">{setupError}</div>}\n        {setupNotice && <div className="setup-notice" role="status">{setupNotice}</div>}\n        <div className="actions">\n          <button className="secondary-button" onClick={onClose}>Done</button>\n          <button className="primary-button" disabled={!quickPersonName.trim()} onClick={addPersonFromHub}>Add person</button>\n        </div>\n        <div className="setup-definition-list" aria-label="People in this month">\n          {(monthPeople || []).length ? (monthPeople || []).map((person) => (\n            <div className="setup-definition-row" key={person.id}>\n              <div>\n                <strong>{person.label}</strong>\n                <small>{personInUse(person.id) ? 'In use this month' : 'Available'}</small>\n              </div>\n              <button type="button" className="danger-button" disabled={personInUse(person.id)} onClick={() => removePersonFromHub(person)}>Remove</button>\n            </div>\n          )) : <div className="empty">No household people have been added for this month yet.</div>}\n        </div>\n      </SimpleModal>\n    );\n  }\n\n`;
replaceRequired(
  `  if (!lockedMode && mode === 'account') {`,
  `${peopleMode}  if (!lockedMode && mode === 'account') {`,
  'People Add mode',
);

// Keep Accounts open after adding so a fresh month can be set up in one visit,
// and show the definitions already available in that month.
replaceRequired(
  `      if (onSetupCreated) onSetupCreated(kindLabel + ' “' + nextAccount.label + '” added to this month.');\n      else onClose();`,
  `      setAccountNameDraft('');\n      setSetupNotice(kindLabel + ' “' + nextAccount.label + '” added to this month.');`,
  'keep Accounts hub open',
);

const oldAccountTabs = `        <div className="tabs record-tabs" role="tablist" aria-label="Add type">\n          <button role="tab" aria-selected={false} onClick={() => { setSetupError(''); setMode('expense'); }}>Expense</button>\n          <button role="tab" aria-selected={false} onClick={() => { setSetupError(''); setMode('income'); }}>Income</button>\n          <button role="tab" aria-selected className="active">Account</button>\n        </div>`;
const newAccountTabs = `        <div className="tabs record-tabs" role="tablist" aria-label="Add type">\n          <button role="tab" aria-selected={false} onClick={() => { setSetupError(''); setSetupNotice(''); setMode('people'); }}>People</button>\n          <button role="tab" aria-selected className="active">Accounts</button>\n          <button role="tab" aria-selected={false} onClick={() => { setSetupError(''); setSetupNotice(''); setMode('income'); }}>Income</button>\n          <button role="tab" aria-selected={false} onClick={() => { setSetupError(''); setSetupNotice(''); setMode('expense'); }}>Expense</button>\n        </div>`;
replaceRequired(oldAccountTabs, newAccountTabs, 'Accounts Add tabs');

replaceRequired(
  `        <p className="section-note">Create the people and accounts needed for this month without leaving + Add. Savings accounts use the Savings snapshot; debit/current accounts and credit cards can be assigned to income and expenses.</p>`,
  `        <p className="section-note">Create debit/current accounts, credit cards and savings accounts for the selected month. Choose the owner here; Settings is no longer used to record people or accounts.</p>`,
  'Accounts explanation',
);

replaceRequired(
  `        <button className="text-button" type="button" onClick={onOpenSettings}>Advanced account management in Settings</button>\n        <div className="actions">`,
  `        {setupNotice && <div className="setup-notice" role="status">{setupNotice}</div>}\n        <div className="setup-definition-list" aria-label="Accounts in this month">\n          {[...(monthAccounts || []), ...savingsForMonth].length ? [...(monthAccounts || []), ...savingsForMonth].map((item) => {\n            const owner = setupOwnerOptions.find((option) => option.id === item.ownerId)?.label || 'Joint';\n            const kind = item.accountType === 'savings' ? 'Savings' : item.accountType === 'credit' ? 'Credit card' : 'Debit / current';\n            return (\n              <div className="setup-definition-row" key={item.id}>\n                <div><strong>{item.label}</strong><small>{kind} · {owner}</small></div>\n              </div>\n            );\n          }) : <div className="empty">No accounts have been added for this month yet.</div>}\n        </div>\n        <div className="actions">`,
  'remove Settings account-management link and show account list',
);

// Settings is now Settings only. People, bank/card accounts and savings-account
// definitions are recorded through + Add (with Savings balances still editable
// on the Savings page). Remove those data-entry sections from Settings itself.
removeSettingsSection('Household People');
removeSettingsSection('Accounts');
removeSettingsSection('Savings Accounts');

const settingsStart = app.indexOf('function SettingsModal(');
const settingsEnd = app.indexOf('\nfunction ', settingsStart + 20);
const settingsBlock = app.slice(settingsStart, settingsEnd > settingsStart ? settingsEnd : app.length);
if (settingsBlock.includes('<h3>Household People</h3>') || settingsBlock.includes('<h3>Accounts</h3>') || settingsBlock.includes('<h3>Savings Accounts</h3>')) {
  throw new Error('v93 Settings still contains people/account recording sections.');
}
if (!app.includes('PENNY_V93_PURE_SETTINGS_ADD_HUB')) throw new Error('v93 marker missing.');
if (!app.includes('>People</button>') || !app.includes('>Accounts</button>')) throw new Error('v93 four-tab Add hub missing.');

await writeFile(appPath, app);

// Older regression files correctly protected the old architecture. Update only
// their UI expectations now that People/Accounts intentionally moved out of Settings.
const settingsAuditPath = 'scripts/settings-menu-audit.mjs';
let settingsAudit = await readFile(settingsAuditPath, 'utf8');
settingsAudit = settingsAudit.replace(
  "for (const heading of ['App Version', 'Household People', 'Accounts', 'Categories', 'Change History', 'Backup and Recovery']) {\n  assert.ok(appSource.includes(heading), `Settings must retain the ${heading} area.`);\n}",
  "for (const heading of ['App Version', 'Categories', 'Change History', 'Backup and Recovery']) {\n  assert.ok(appSource.includes(heading), `Settings must retain the ${heading} area.`);\n}\nconst settingsModalStart = appSource.indexOf('function SettingsModal(');\nconst settingsModalEnd = appSource.indexOf('\\nfunction ', settingsModalStart + 20);\nconst settingsModalSource = appSource.slice(settingsModalStart, settingsModalEnd > settingsModalStart ? settingsModalEnd : appSource.length);\nassert.doesNotMatch(settingsModalSource, /<h3>Household People<\\/h3>/, 'Settings must not record household people.');\nassert.doesNotMatch(settingsModalSource, /<h3>Accounts<\\/h3>/, 'Settings must not record bank or card accounts.');\nassert.doesNotMatch(settingsModalSource, /<h3>Savings Accounts<\\/h3>/, 'Settings must not record savings account definitions.');",
);
await writeFile(settingsAuditPath, settingsAudit);

const v92TestPath = 'scripts/add-hub-v92-test.mjs';
let v92Test = await readFile(v92TestPath, 'utf8');
v92Test = v92Test.replace(
  "assert.match(app, /Advanced account management in Settings/, 'Settings must remain available as an administrative fallback');",
  "assert.doesNotMatch(app, /Advanced account management in Settings/, 'People and account recording must no longer route back through Settings');",
);
await writeFile(v92TestPath, v92Test);

console.log('PENNY_V93 pure Settings and four-tab Add hub applied');
