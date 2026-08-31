import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/apply-v84-final.mjs';
let text = await readFile(path, 'utf8');

function replaceRequired(before, after, label) {
  if (text.includes(after)) return;
  if (!text.includes(before)) throw new Error(`prepare-v84 missing ${label}`);
  text = text.replace(before, after);
}

replaceRequired(
`  const transactionsCallBefore = \`          <Transactions
            summary={summary}
            categoryMap={categoryMap}
            peopleMap={peopleMap}
            accountMap={accountMap}
            canEdit={canEditMonth}\`;
  const transactionsCallAfter = \`          <Transactions
            summary={summary}
            categoryMap={categoryMap}
            peopleMap={peopleMap}
            accountMap={accountMap}
            peopleOptions={peopleOptions}
            accountOptions={accountOptions}
            canEdit={canEditMonth}\`;`,
`  const transactionsCallBefore = \`            summary={summary}
            categoryMap={categoryMap}
            peopleMap={peopleMap}
            accountMap={accountMap}
            canEdit={canEditMonth}\`;
  const transactionsCallAfter = \`            summary={summary}
            categoryMap={categoryMap}
            peopleMap={peopleMap}
            accountMap={accountMap}
            peopleOptions={peopleOptions}
            accountOptions={accountOptions}
            canEdit={canEditMonth}\`;`,
  'Transactions call anchor',
);

replaceRequired(
`    'function Transactions({ summary, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onToggleIncomeReceived, onDeleteTransaction, onDeleteIncome }) {',
    'function Transactions({ summary, categoryMap, peopleMap, accountMap, peopleOptions, accountOptions, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onAssignTransaction, onAssignIncome, onToggleIncomeReceived, onDeleteTransaction, onDeleteIncome }) {',`,
`    'function Transactions({ selectedTab, onTabChange, state, monthKey, month, year, mutate, summary, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onToggleIncomeReceived, onDeleteTransaction, onDeleteIncome }) {',
    'function Transactions({ selectedTab, onTabChange, state, monthKey, month, year, mutate, summary, categoryMap, peopleMap, accountMap, peopleOptions, accountOptions, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onAssignTransaction, onAssignIncome, onToggleIncomeReceived, onDeleteTransaction, onDeleteIncome }) {',`,
  'Transactions signature anchor',
);

replaceRequired(
`  const oldExpenseLine = \`        <div className="record-meta assignment-line"><AssignmentValue value={transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || transaction.paidBy} unassigned={!transaction.paidBy || transaction.paidBy === 'unassigned'} fieldLabel="Paid By" canEdit={canEdit} onAssign={() => onEdit(transaction, 'paidBy')} /> <span aria-hidden="true">·</span> <AssignmentValue value={accountLabel} unassigned={!transaction.account || transaction.account === 'unassigned'} fieldLabel="Account" canEdit={canEdit} onAssign={() => onEdit(transaction, 'account')} /></div>\`;
  const newExpenseLine = \`        <div className="record-meta assignment-line">Paid by <AssignmentSelect value={transaction.paidBy || 'unassigned'} displayValue={transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || ''} placeholder="User" fieldLabel="Paid by" options={peopleOptions} canEdit={canEdit} onAssign={(value) => onAssign(transaction, 'paidBy', value)} /> <span aria-hidden="true">·</span> <AssignmentSelect value={transaction.account || 'unassigned'} displayValue={accountLabel} placeholder="Account" fieldLabel="Account" options={accountOptions} canEdit={canEdit} onAssign={(value) => onAssign(transaction, 'account', value)} /></div>\`;`,
`  const oldExpenseLine = \`        <div className="record-meta assignment-line"><AssignmentValue value={transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || transaction.paidBy} unassigned={!transaction.paidBy || transaction.paidBy === 'unassigned'} fieldLabel="Paid By" canEdit={canEdit} onAssign={() => onEdit(transaction, 'paidBy')} /> <span aria-hidden="true">·</span> <AssignmentValue value={ownedRecordAccountLabel(transaction, accountMap, peopleMap)} unassigned={!transaction.account || transaction.account === 'unassigned'} fieldLabel="Account" canEdit={canEdit} onAssign={() => onEdit(transaction, 'account')} /></div>\`;
  const newExpenseLine = \`        <div className="record-meta assignment-line">Paid by <AssignmentSelect value={transaction.paidBy || 'unassigned'} displayValue={transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || ''} placeholder="User" fieldLabel="Paid by" options={peopleOptions} canEdit={canEdit} onAssign={(value) => onAssign(transaction, 'paidBy', value)} /> <span aria-hidden="true">·</span> <AssignmentSelect value={transaction.account || 'unassigned'} displayValue={ownedRecordAccountLabel(transaction, accountMap, peopleMap)} placeholder="Account" fieldLabel="Account" options={accountOptions} canEdit={canEdit} onAssign={(value) => onAssign(transaction, 'account', value)} /></div>\`;`,
  'Expense account display anchor',
);

await writeFile(path, text);
console.log('v84 transformed-source anchors prepared');
