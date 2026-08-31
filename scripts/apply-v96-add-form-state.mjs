import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

function replaceRequired(before, after, label) {
  if (app.includes(after)) return;
  if (!app.includes(before)) throw new Error('v96 missing anchor: ' + label);
  app = app.replace(before, after);
}

// New records must never invent an exact date. Existing records retain their
// evidence state and exact date exactly as stored.
replaceRequired(
  `  const initialDateConfirmed = existing ? !existingIssues.includes('date') : monthKey === currentLocalPeriod().key;`,
  `  const initialDateConfirmed = existing ? !existingIssues.includes('date') : false;`,
  'new record exact date starts TBC',
);
replaceRequired(
  `  const [date, setDate] = useState(initialDateConfirmed ? (existing?.date || localDateKey()) : '');`,
  `  const [date, setDate] = useState(existing && initialDateConfirmed ? existing.date : '');`,
  'new record date starts blank',
);

// A money field should be a plain decimal text entry. The existing financial
// validation remains responsible for whole-penny precision and safe limits.
replaceRequired(
  `<input id="record-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />`,
  `<input id="record-amount" type="text" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); if (formError) setFormError(''); }} />`,
  'plain amount entry without spinner',
);
replaceRequired(
  `<input id="record-description" value={description} onChange={(event) => setDescription(event.target.value)} />`,
  `<input id="record-description" value={description} onChange={(event) => { setDescription(event.target.value); if (formError) setFormError(''); }} />`,
  'clear validation when record text changes',
);

// Make the four Add tabs independent drafts. Changing section intentionally
// starts the destination form blank so Income values/errors can never leak into
// Expense (or vice versa).
const saveAnchor = `  const save = () => {`;
const switchHelper = `  const switchAddMode = (nextMode) => {\n    if (lockedMode || nextMode === mode) return;\n    setFormError('');\n    setSetupError('');\n    setSetupNotice('');\n    setQuickAdd(null);\n    setDescription('');\n    setAmount('');\n    setDateConfirmed(false);\n    setDate('');\n    setCategory('');\n    setExpenseClass(presetClass || 'variable');\n    setPaid(false);\n    setPaidBy('unassigned');\n    setAccount('unassigned');\n    setReceivedBy('unassigned');\n    setIncomeType('');\n    setIncomeStatus('received');\n    setQuickPersonName('');\n    setAccountNameDraft('');\n    setAccountTypeDraft('');\n    setAccountOwnerDraft('');\n    setMode(nextMode);\n  };\n\n`;
if (!app.includes('const switchAddMode = (nextMode) =>')) {
  const savePos = app.indexOf(saveAnchor, app.indexOf('function RecordModal('));
  if (savePos < 0) throw new Error('v96 could not find RecordModal save function');
  app = app.slice(0, savePos) + switchHelper + app.slice(savePos);
}

const handlerPairs = [
  [`onClick={() => setMode('income')}`, `onClick={() => switchAddMode('income')}`],
  [`onClick={() => setMode('expense')}`, `onClick={() => switchAddMode('expense')}`],
  [`onClick={() => { setFormError(''); setSetupError(''); setMode('people'); }}`, `onClick={() => switchAddMode('people')}`],
  [`onClick={() => { setFormError(''); setSetupError(''); setMode('account'); }}`, `onClick={() => switchAddMode('account')}`],
  [`onClick={() => { setSetupError(''); setSetupNotice(''); setMode('people'); }}`, `onClick={() => switchAddMode('people')}`],
  [`onClick={() => { setSetupError(''); setSetupNotice(''); setMode('account'); }}`, `onClick={() => switchAddMode('account')}`],
  [`onClick={() => { setSetupError(''); setSetupNotice(''); setMode('income'); }}`, `onClick={() => switchAddMode('income')}`],
  [`onClick={() => { setSetupError(''); setSetupNotice(''); setMode('expense'); }}`, `onClick={() => switchAddMode('expense')}`],
];
for (const [before, after] of handlerPairs) app = app.replaceAll(before, after);

// People creation is intentionally quiet: the newly-added row is the feedback.
const peopleStart = app.indexOf(`  if (!lockedMode && mode === 'people') {`);
const accountStart = app.indexOf(`  if (!lockedMode && mode === 'account') {`, peopleStart);
if (!(peopleStart >= 0 && accountStart > peopleStart)) throw new Error('v96 could not isolate People mode');
let peopleBlock = app.slice(peopleStart, accountStart);
peopleBlock = peopleBlock.replaceAll(`      setSetupNotice('“' + person.label + '” added to this month.');\n`, `      setSetupNotice('');\n`);
peopleBlock = peopleBlock.replaceAll(`        {setupNotice && <div className="setup-notice" role="status">{setupNotice}</div>}\n`, '');
if (peopleBlock.includes('added to this month.')) throw new Error('v96 People still renders an add confirmation');
app = app.slice(0, peopleStart) + peopleBlock + app.slice(accountStart);

// Accounts get the same safe removal affordance as People. Current-month
// records protect an in-use account from removal; unused bank/card or savings
// definitions can be removed with explicit confirmation.
const refreshedAccountStart = app.indexOf(`  if (!lockedMode && mode === 'account') {`);
const saveStart = app.indexOf(`  const switchAddMode = (nextMode) =>`, refreshedAccountStart);
if (!(refreshedAccountStart >= 0 && saveStart > refreshedAccountStart)) throw new Error('v96 could not isolate Account mode');
let accountBlock = app.slice(refreshedAccountStart, saveStart);
if (!accountBlock.includes('const removeAccountFromHub = (item) =>')) {
  const returnPos = accountBlock.indexOf(`    return (`);
  if (returnPos < 0) throw new Error('v96 Account return anchor missing');
  const helpers = `    const currentTxns = state?.txnsByMonth?.[monthKey] || [];\n    const currentIncome = state?.incomeByMonth?.[monthKey] || [];\n    const accountInUse = (item) => currentTxns.some((row) => row.account === item.id) || currentIncome.some((row) => row.account === item.id);\n    const removeAccountFromHub = (item) => {\n      if (accountInUse(item)) return;\n      if (!globalThis.confirm('Remove “' + item.label + '” from this month?')) return;\n      const isSavings = item.accountType === 'savings' || savingsForMonth.some((row) => row.id === item.id);\n      if (isSavings) {\n        mutate({\n          type: 'SET_SAVINGS_ACCOUNTS',\n          monthKey,\n          items: savingsForMonth.filter((row) => row.id !== item.id),\n          auditLabel: 'Remove ' + item.label + ' savings account from ' + monthKey,\n        });\n      } else {\n        mutate({\n          type: 'SET_MONTH_REFERENCE_LIST',\n          monthKey,\n          field: 'accounts',\n          items: (monthAccounts || []).filter((row) => row.id !== item.id),\n          auditLabel: 'Remove ' + item.label + ' account from ' + monthKey,\n        });\n      }\n    };\n`;
  accountBlock = accountBlock.slice(0, returnPos) + helpers + accountBlock.slice(returnPos);
}
const accountRowOld = `<div className="setup-definition-row" key={item.id}>\n                <div><strong>{item.label}</strong><small>{kind} · {owner}</small></div>\n              </div>`;
const accountRowNew = `<div className="setup-definition-row" key={item.id}>\n                <div><strong>{item.label}</strong><small>{kind} · {owner}{accountInUse(item) ? ' · In use this month' : ''}</small></div>\n                <button type="button" className="danger-button" disabled={accountInUse(item)} onClick={() => removeAccountFromHub(item)}>Remove</button>\n              </div>`;
if (!accountBlock.includes(accountRowNew)) {
  if (!accountBlock.includes(accountRowOld)) throw new Error('v96 account row anchor missing');
  accountBlock = accountBlock.replace(accountRowOld, accountRowNew);
}
app = app.slice(0, refreshedAccountStart) + accountBlock + app.slice(saveStart);

// Income ownership is derived from the selected owner-labelled account. One
// selector is therefore sufficient and prevents contradictory person/account
// combinations.
const recordStart = app.indexOf('function RecordModal(');
const refStart = app.indexOf('\nfunction ReferenceSelect(', recordStart);
if (!(recordStart >= 0 && refStart > recordStart)) throw new Error('v96 could not isolate RecordModal');
let modal = app.slice(recordStart, refStart);

// Remove any legacy second Income-type validation left by an older transform.
modal = modal.replace(/\n\s*if \(!incomeType\.trim\(\)\) \{\n\s*setFormError\('Income type is required\.'\);\n\s*return;\n\s*\}/g, '');

const incomeBranchStart = modal.indexOf(`    if (mode === 'income') {`);
const expenseSaveStart = modal.indexOf(`    const type = mode === 'movement' ? movementType : 'expense';`, incomeBranchStart);
if (!(incomeBranchStart >= 0 && expenseSaveStart > incomeBranchStart)) throw new Error('v96 could not isolate Income save branch');
let incomeSave = modal.slice(incomeBranchStart, expenseSaveStart);
if (!incomeSave.includes('const resolvedReceivedBy =')) {
  incomeSave = incomeSave.replace(
    `    if (mode === 'income') {`,
    `    if (mode === 'income') {\n      const selectedIncomeAccount = (accountOptions || []).find((item) => item.id === account);\n      const resolvedReceivedBy = selectedIncomeAccount?.ownerId && selectedIncomeAccount.ownerId !== 'unassigned'\n        ? selectedIncomeAccount.ownerId\n        : (income?.account === account ? (income?.receivedBy || 'unassigned') : 'unassigned');`,
  );
}
incomeSave = incomeSave.replace(`        receivedBy,\n        account,`, `        receivedBy: resolvedReceivedBy,\n        account,`);
incomeSave = incomeSave.replace(`          receivedBy,\n          account,`, `          receivedBy: resolvedReceivedBy,\n          account,`);
incomeSave = incomeSave.replace(
  `          receivedByLabel: preservedOrSelectedLabel(income?.receivedBy, income?.receivedByLabel, receivedBy, peopleOptions),`,
  `          receivedByLabel: preservedOrSelectedLabel(income?.receivedBy, income?.receivedByLabel, resolvedReceivedBy, peopleOptions),`,
);
modal = modal.slice(0, incomeBranchStart) + incomeSave + modal.slice(expenseSaveStart);

const receivedGrid = `<div className="form-grid">\n            <ReferenceSelect id="income-received-by" label="Received By" value={receivedBy} options={peopleOptions} onChange={setReceivedBy} />\n            <ReferenceSelect id="income-account" label="Account" value={account} options={accountOptions} onChange={setAccount} />\n          </div>`;
const receivedSingle = `<ReferenceSelect id="income-account" label="Received into account" value={account} options={accountOptions} onChange={(nextAccount) => {\n            setAccount(nextAccount);\n            const selected = (accountOptions || []).find((item) => item.id === nextAccount);\n            setReceivedBy(selected?.ownerId || 'unassigned');\n            if (formError) setFormError('');\n          }} />`;
if (!modal.includes(receivedSingle)) {
  if (!modal.includes(receivedGrid)) throw new Error('v96 Income Received By / Account grid anchor missing');
  modal = modal.replace(receivedGrid, receivedSingle);
}
if (modal.includes('label="Received By"')) throw new Error('v96 Income still renders a separate Received By selector');
if (modal.includes(`if (!incomeType.trim())`)) throw new Error('v96 Income still validates removed incomeType state');
app = app.slice(0, recordStart) + modal + app.slice(refStart);

if (!app.includes('PENNY_V95_CLEAN_ADD_FLOW')) throw new Error('v96 requires v95 base');
app = app.replace('PENNY_V95_CLEAN_ADD_FLOW', 'PENNY_V95_CLEAN_ADD_FLOW PENNY_V96_ADD_FORM_STATE');
await writeFile(appPath, app);
console.log('PENNY_V96 independent Add forms, account removal and account-derived income ownership applied');
