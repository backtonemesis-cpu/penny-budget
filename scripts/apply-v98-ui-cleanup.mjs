import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

function replaceRequired(before, after, label) {
  if (app.includes(after)) return;
  if (!app.includes(before)) throw new Error('v98 missing anchor: ' + label);
  app = app.replace(before, after);
}

// Account type is a required choice. Keep the blank value only as a hidden
// placeholder and expose the three concise choices the user actually selects.
app = app.replaceAll('<option value="">Select account type</option>', '<option value="" disabled hidden></option>');
app = app.replaceAll('<option value="credit">Credit card</option>', '<option value="credit">Credit</option>');
app = app.replaceAll('<option value="savings">Savings account</option>', '<option value="savings">Savings</option>');

// Selecting an owner-labelled account is sufficient evidence for payer / recipient.
// Derive the person from the account instead of maintaining two contradictory controls.
replaceRequired(
  `      if (account && !assignmentOwnerCompatible(account, draft.paidBy)) {\n        setMessage('Choose an account that matches the selected payer.');\n        return;\n      }\n      draft.account = nextValue;\n      draft.accountLabel = nextValue === 'unassigned' ? '' : account?.label || '';\n      draft.accountOwnerId = nextValue === 'unassigned' ? 'unassigned' : account?.ownerId || 'unassigned';\n      draft.accountOwnerLabel = nextValue === 'unassigned' ? '' : peopleOptions.find((item) => item.id === account?.ownerId)?.label || '';`,
  `      const ownerId = nextValue === 'unassigned' ? 'unassigned' : account?.ownerId || 'unassigned';\n      const owner = peopleOptions.find((item) => item.id === ownerId);\n      draft.paidBy = ownerId;\n      draft.paidByLabel = ownerId === 'unassigned' ? '' : owner?.label || '';\n      draft.account = nextValue;\n      draft.accountLabel = nextValue === 'unassigned' ? '' : account?.label || '';\n      draft.accountOwnerId = ownerId;\n      draft.accountOwnerLabel = ownerId === 'unassigned' ? '' : owner?.label || '';`,
  'expense account derives payer',
);
replaceRequired(
  `      if (account && !assignmentOwnerCompatible(account, draft.receivedBy)) {\n        setMessage('Choose an account that matches the selected recipient.');\n        return;\n      }\n      draft.account = nextValue;\n      draft.accountLabel = nextValue === 'unassigned' ? '' : account?.label || '';\n      draft.accountOwnerId = nextValue === 'unassigned' ? 'unassigned' : account?.ownerId || 'unassigned';\n      draft.accountOwnerLabel = nextValue === 'unassigned' ? '' : peopleOptions.find((item) => item.id === account?.ownerId)?.label || '';`,
  `      const ownerId = nextValue === 'unassigned' ? 'unassigned' : account?.ownerId || 'unassigned';\n      const owner = peopleOptions.find((item) => item.id === ownerId);\n      draft.receivedBy = ownerId;\n      draft.receivedByLabel = ownerId === 'unassigned' ? '' : owner?.label || '';\n      draft.account = nextValue;\n      draft.accountLabel = nextValue === 'unassigned' ? '' : account?.label || '';\n      draft.accountOwnerId = ownerId;\n      draft.accountOwnerLabel = ownerId === 'unassigned' ? '' : owner?.label || '';`,
  'income account derives recipient',
);

// Cards show one owner-labelled account selector, not duplicate person + account selectors.
replaceRequired(
  `                <div className="record-meta assignment-line">Received by <AssignmentSelect value={record.receivedBy || 'unassigned'} displayValue={record.receivedByLabel || peopleMap[record.receivedBy]?.label || ''} placeholder="User" fieldLabel="Received by" options={personChoices} canEdit={canEdit} onAssign={(value) => onAssignIncome(record, 'receivedBy', value)} /> <span aria-hidden="true">·</span> <AssignmentSelect value={record.account || 'unassigned'} displayValue={ownedRecordAccountLabel(record, accountMap, peopleMap)} placeholder="Account" fieldLabel="Account" options={accountChoicesFor(record.receivedBy)} canEdit={canEdit} onAssign={(value) => onAssignIncome(record, 'account', value)} /></div>`,
  `                <div className="record-meta assignment-line"><AssignmentSelect value={record.account || 'unassigned'} displayValue={ownedRecordAccountLabel(record, accountMap, peopleMap)} placeholder="Account" fieldLabel="Received into account" options={accountChoicesFor('unassigned')} canEdit={canEdit} onAssign={(value) => onAssignIncome(record, 'account', value)} /></div>`,
  'single income card account selector',
);
replaceRequired(
  `        <div className="record-meta assignment-line">Paid by <AssignmentSelect value={transaction.paidBy || 'unassigned'} displayValue={transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || ''} placeholder="User" fieldLabel="Paid by" options={peopleOptions} canEdit={canEdit} onAssign={(value) => onAssign(transaction, 'paidBy', value)} /> <span aria-hidden="true">·</span> <AssignmentSelect value={transaction.account || 'unassigned'} displayValue={accountLabel} placeholder="Account" fieldLabel="Account" options={accountOptions} canEdit={canEdit} onAssign={(value) => onAssign(transaction, 'account', value)} /></div>`,
  `        <div className="record-meta assignment-line"><AssignmentSelect value={transaction.account || 'unassigned'} displayValue={accountLabel} placeholder="Account" fieldLabel="Paid from account" options={accountOptions} canEdit={canEdit} onAssign={(value) => onAssign(transaction, 'account', value)} /></div>`,
  'single expense card account selector',
);

// Expense editor: one account selector. Account owner becomes the payer.
replaceRequired(
  `          <div className="form-grid">\n            <ReferenceSelect id="record-paid-by" label="Paid By" value={paidBy} options={peopleOptions} onChange={setPaidBy} />\n            <ReferenceSelect id="record-account" label="Account" value={account} options={accountOptions} onChange={setAccount} />\n          </div>`,
  `          <ReferenceSelect id="record-account" label="Paid from account" value={account} options={accountOptions} onChange={(nextAccount) => {\n            setAccount(nextAccount);\n            const selected = (accountOptions || []).find((item) => item.id === nextAccount);\n            setPaidBy(selected?.ownerId || 'unassigned');\n            if (formError) setFormError('');\n          }} />`,
  'single expense form account selector',
);

// New record dates are simply optional. Blank means TBC; choosing a date confirms it.
const oldDateBlock = `      <div className="field">\n        <label htmlFor="record-date">Exact date</label>\n        <input\n          id="record-date"\n          type="date"\n          value={date}\n          disabled={!dateConfirmed}\n          onChange={(event) => {\n            setDate(event.target.value);\n            if (event.target.value) setDateConfirmed(true);\n          }}\n        />\n      </div>\n      <label className="evidence-toggle">\n        <input\n          type="checkbox"\n          checked={!dateConfirmed}\n          onChange={(event) => {\n            const unknown = event.target.checked;\n            setDateConfirmed(!unknown);\n            if (unknown) setDate('');\n          }}\n        />\n        <span><strong>Exact date not confirmed</strong><small>Penny will show “Date TBC” and use the 1st internally only to keep the record in the selected month.</small></span>\n      </label>`;
const newDateBlock = `      <div className="field">\n        <label htmlFor="record-date">Exact date</label>\n        <input\n          id="record-date"\n          type="date"\n          value={date}\n          onChange={(event) => {\n            const nextDate = event.target.value;\n            setDate(nextDate);\n            setDateConfirmed(Boolean(nextDate));\n            if (formError) setFormError('');\n          }}\n        />\n      </div>`;
replaceRequired(oldDateBlock, newDateBlock, 'simple optional exact date');
replaceRequired(
  `    if (dateConfirmed && !date) {\n      setFormError('Enter the confirmed date, or mark the exact date as not confirmed.');\n      return;\n    }`,
  `    if (dateConfirmed && !date) {\n      setFormError('Enter the exact date or leave it blank.');\n      return;\n    }`,
  'date validation wording',
);

// Expected/Received already communicates receipt state. Do not duplicate it with
// a separate “Receipt status TBC” badge.
replaceRequired(
  `  if (record.needsConfirmation) badges.push(<span key="confirm" className="status-pill warning">{confirmationSummary(record.confirmationIssues)}</span>);`,
  `  const visibleIssues = (record.confirmationIssues || []).filter((issue) => issue !== 'received');\n  if (record.needsConfirmation && visibleIssues.length) badges.push(<span key="confirm" className="status-pill warning">{confirmationSummary(visibleIssues)}</span>);`,
  'hide duplicate receipt-status badge',
);

// Savings balance is direct text entry with existing exact-penny validation.
replaceRequired(
  `type="number" inputMode="decimal" step="0.01" value={balance} placeholder="0.00" aria-invalid={Boolean(balanceError)}`,
  `type="text" inputMode="decimal" value={balance} placeholder="0.00" aria-invalid={Boolean(balanceError)}`,
  'plain savings balance input',
);

if (!app.includes('PENNY_V97_ADD_TABS_CLICKABLE')) throw new Error('v98 requires v97 base');
if (!app.includes('PENNY_V98_UI_CLEANUP')) {
  app = app.replace('PENNY_V97_ADD_TABS_CLICKABLE', 'PENNY_V97_ADD_TABS_CLICKABLE PENNY_V98_UI_CLEANUP');
}
await writeFile(appPath, app);

// The build-time date layout helper must render the same optional date field.
const layoutPath = 'build/record-date-layout.js';
let layout = await readFile(layoutPath, 'utf8');
layout = layout.replace(/function fallbackDateBlock\(\) \{[\s\S]*?\n\}\n\nfunction conditionalDateBlock/, `function fallbackDateBlock() {\n  return \`<div className="field">\n        <label htmlFor="record-date">Exact date</label>\n        <input\n          id="record-date"\n          type="date"\n          value={date}\n          onChange={(event) => {\n            const nextDate = event.target.value;\n            setDate(nextDate);\n            setDateConfirmed(Boolean(nextDate));\n            if (formError) setFormError('');\n          }}\n        />\n      </div>\`;\n}\n\nfunction conditionalDateBlock`);
layout = layout.replace("    if (!extracted.includes('Exact date not confirmed') || !extracted.includes('id=\"record-date\"')) {\n      fail('The existing Exact date block is incomplete.');\n    }\n    dateBlock = extracted.trim();", "    if (!extracted.includes('id=\"record-date\"')) {\n      fail('The existing Exact date block is incomplete.');\n    }\n    dateBlock = fallbackDateBlock();");
layout = layout.replace("  const tbcControlCount = (modal.match(/Exact date not confirmed/g) || []).length;\n  if (tbcControlCount !== 3) fail(`Expected 3 mode-specific Exact date TBC controls, found ${tbcControlCount}.`);", "  const tbcControlCount = (modal.match(/Exact date not confirmed/g) || []).length;\n  if (tbcControlCount !== 0) fail(`Expected no Exact date TBC checkbox controls, found ${tbcControlCount}.`);");
if (layout.includes('Exact date not confirmed</strong>')) throw new Error('v98 date layout still renders the old TBC checkbox');
await writeFile(layoutPath, layout);

// Avoid a double divider between the final savings row and the snapshot total.
const stylesPath = 'src/styles.css';
let styles = await readFile(stylesPath, 'utf8');
if (!styles.includes('.savings-detail-row + .total-line')) {
  styles += `\n/* PENNY_V98_UI_CLEANUP */\n.savings-detail-row + .total-line { border-top: 0; }\n`;
}
await writeFile(stylesPath, styles);

console.log('PENNY_V98 single account assignment, clean status/date controls and plain savings entry applied');
