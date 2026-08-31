import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

const replacements = [
  [
    "            onEdit={(record) => openRecord({ mode: 'income', income: record })}",
    "            onEdit={(record, focusField) => openRecord({ mode: 'income', income: record, focusField })}",
  ],
  [
    "            onEdit={(transaction) => openRecord({ mode: 'expense', transaction })}",
    "            onEdit={(transaction, focusField) => openRecord({ mode: 'expense', transaction, focusField })}",
  ],
  [
    `              <div className="record-meta">Received by: {record.receivedByLabel || peopleMap[record.receivedBy]?.label || record.receivedBy || 'TBC'}</div>\n              <div className="record-meta">Account: {ownedRecordAccountLabel(record, accountMap, peopleMap)}</div>`,
    `              <div className="record-meta assignment-line">Received by <AssignmentValue value={record.receivedByLabel || peopleMap[record.receivedBy]?.label || record.receivedBy} unassigned={!record.receivedBy || record.receivedBy === 'unassigned'} fieldLabel="Received By" canEdit={canEdit} onAssign={() => onEdit(record, 'receivedBy')} /> <span aria-hidden="true">·</span> <AssignmentValue value={ownedRecordAccountLabel(record, accountMap, peopleMap)} unassigned={!record.account || record.account === 'unassigned'} fieldLabel="Account" canEdit={canEdit} onAssign={() => onEdit(record, 'account')} /></div>`,
  ],
  [
    '              <div className="record-meta">{paidBy} · {accountLabel}</div>',
    '              <div className="record-meta assignment-line"><AssignmentValue value={paidBy} unassigned={!transaction.paidBy || transaction.paidBy === \'unassigned\'} fieldLabel="Paid By" canEdit={canEdit} onAssign={() => onEdit(transaction, \'paidBy\')} /> <span aria-hidden="true">·</span> <AssignmentValue value={accountLabel} unassigned={!transaction.account || transaction.account === \'unassigned\'} fieldLabel="Account" canEdit={canEdit} onAssign={() => onEdit(transaction, \'account\')} /></div>',
  ],
];

for (const [before, after] of replacements) {
  if (app.includes(after)) continue;
  if (!app.includes(before)) throw new Error(`v77 missing safe assignment-control anchor: ${before.slice(0, 80)}`);
  app = app.replace(before, after);
}

if (!app.includes("onEdit(record, 'receivedBy')") || !app.includes("onEdit(transaction, 'paidBy')")) {
  throw new Error('v77 failed to install field-specific Income and Expense assignment controls.');
}

await writeFile(appPath, app);
console.log('PENNY_V77_ASSIGNMENT_CONTROLS applied');

