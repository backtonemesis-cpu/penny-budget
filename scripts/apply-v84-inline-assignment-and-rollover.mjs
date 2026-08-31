import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(text, before, after, label) {
  if (text.includes(after)) return text;
  const index = text.indexOf(before);
  if (index < 0) throw new Error(`v84 missing anchor: ${label}`);
  if (text.indexOf(before, index + before.length) >= 0) throw new Error(`v84 ambiguous anchor: ${label}`);
  return text.slice(0, index) + after + text.slice(index + before.length);
}

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

if (!app.includes('PENNY_V84_INLINE_ASSIGNMENT')) {
  const handlerAnchor = '  const toggleIncomeReceived = (record) => {';
  const handlers = `  // PENNY_V84_INLINE_ASSIGNMENT\n  const assignmentOwnerCompatible = (account, personId) => {\n    if (!account || account.id === 'unassigned' || !personId || personId === 'unassigned') return true;\n    const ownerId = account.ownerId || 'unassigned';\n    if (personId === 'household') return ownerId === 'household' || ownerId === 'unassigned';\n    return ownerId === personId || ownerId === 'household' || ownerId === 'unassigned';\n  };\n\n  const assignExpenseReference = (transaction, field, value) => {\n    if (!canEditMonth) {\n      setMessage('This month is locked. Unlock corrections before changing assignments.');\n      return;\n    }\n    const nextValue = value || 'unassigned';\n    let draft = { ...transaction };\n    if (field === 'paidBy') {\n      const person = peopleOptions.find((item) => item.id === nextValue);\n      draft.paidBy = nextValue;\n      draft.paidByLabel = nextValue === 'unassigned' ? '' : person?.label || '';\n      const currentAccount = accountOptions.find((item) => item.id === draft.account);\n      if (currentAccount && !assignmentOwnerCompatible(currentAccount, nextValue)) {\n        draft.account = 'unassigned';\n        draft.accountLabel = '';\n        draft.accountOwnerId = 'unassigned';\n        draft.accountOwnerLabel = '';\n      }\n    } else if (field === 'account') {\n      const account = accountOptions.find((item) => item.id === nextValue);\n      if (nextValue !== 'unassigned' && !account) {\n        setMessage('That account is not available for this month.');\n        return;\n      }\n      if (account && !assignmentOwnerCompatible(account, draft.paidBy)) {\n        setMessage('Choose an account that matches the selected payer.');\n        return;\n      }\n      draft.account = nextValue;\n      draft.accountLabel = nextValue === 'unassigned' ? '' : account?.label || '';\n      draft.accountOwnerId = nextValue === 'unassigned' ? 'unassigned' : account?.ownerId || 'unassigned';\n      draft.accountOwnerLabel = nextValue === 'unassigned' ? '' : peopleOptions.find((item) => item.id === account?.ownerId)?.label || '';\n    } else return;\n    const next = normaliseTransaction(draft, state.customCats);\n    if (!next) return;\n    mutate({ type: 'UPDATE_TXN', monthKey: transaction.date.slice(0, 7), txn: next, auditLabel: \\`Assign \\${transaction.desc} \\${field === 'paidBy' ? 'payer' : 'account'}\\` });\n  };\n\n  const assignIncomeReference = (record, field, value) => {\n    if (!canEditMonth) {\n      setMessage('This month is locked. Unlock corrections before changing assignments.');\n      return;\n    }\n    const nextValue = value || 'unassigned';\n    let draft = { ...record };\n    if (field === 'receivedBy') {\n      const person = peopleOptions.find((item) => item.id === nextValue);\n      draft.receivedBy = nextValue;\n      draft.receivedByLabel = nextValue === 'unassigned' ? '' : person?.label || '';\n      const currentAccount = accountOptions.find((item) => item.id === draft.account);\n      if (currentAccount && !assignmentOwnerCompatible(currentAccount, nextValue)) {\n        draft.account = 'unassigned';\n        draft.accountLabel = '';\n        draft.accountOwnerId = 'unassigned';\n        draft.accountOwnerLabel = '';\n      }\n    } else if (field === 'account') {\n      const account = accountOptions.find((item) => item.id === nextValue);\n      if (nextValue !== 'unassigned' && !account) {\n        setMessage('That account is not available for this month.');\n        return;\n      }\n      if (account && !assignmentOwnerCompatible(account, draft.receivedBy)) {\n        setMessage('Choose an account that matches the selected recipient.');\n        return;\n      }\n      draft.account = nextValue;\n      draft.accountLabel = nextValue === 'unassigned' ? '' : account?.label || '';\n      draft.accountOwnerId = nextValue === 'unassigned' ? 'unassigned' : account?.ownerId || 'unassigned';\n      draft.accountOwnerLabel = nextValue === 'unassigned' ? '' : peopleOptions.find((item) => item.id === account?.ownerId)?.label || '';\n    } else return;\n    const next = normaliseIncomeRecord(draft, record.date.slice(0, 7));\n    if (!next) return;\n    mutate({ type: 'UPDATE_INCOME', monthKey: record.date.slice(0, 7), record: next, auditLabel: \\`Assign \\${record.description} \\${field === 'receivedBy' ? 'recipient' : 'account'}\\` });\n  };\n\n`;
  if (!app.includes(handlerAnchor)) throw new Error('v84 missing assignment handler insertion point.');
  app = app.replace(handlerAnchor, handlers + handlerAnchor);

  app = replaceOnce(
    app,
    "      income: copies.income,\n      auditLabel: `Set up ${MONTHS[period.month]} ${period.year} from recurring records`,",
    "      income: copies.income,\n      copyPeople: !(state.peopleByMonth?.[monthKey]?.length),\n      copyAccounts: !(state.accountsByMonth?.[monthKey]?.length),\n      auditLabel: `Set up ${MONTHS[period.month]} ${period.year} from recurring records`,",
    'month setup must carry people and accounts into a blank target month',
  );

  app = replaceOnce(
    app,
    "            peopleMap={peopleMap}\n            accountMap={accountMap}\n            canEdit={canEditMonth}",
    "            peopleMap={peopleMap}\n            accountMap={accountMap}\n            peopleOptions={peopleOptions}\n            accountOptions={accountOptions}\n            canEdit={canEditMonth}",
    'Transactions assignment options',
  );

  app = replaceOnce(
    app,
    "            onEditIncome={(record, focusField) => openRecord({ mode: 'income', income: record, focusField })}\n            onToggleIncomeReceived={toggleIncomeReceived}",
    "            onEditIncome={(record, focusField) => openRecord({ mode: 'income', income: record, focusField })}\n            onAssignTransaction={assignExpenseReference}\n            onAssignIncome={assignIncomeReference}\n            onToggleIncomeReceived={toggleIncomeReceived}",
    'Transactions assignment handlers',
  );

  app = replaceOnce(
    app,
    'function Transactions({ summary, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onToggleIncomeReceived, onDeleteTransaction, onDeleteIncome }) {',
    'function Transactions({ summary, categoryMap, peopleMap, accountMap, peopleOptions, accountOptions, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onAssignTransaction, onAssignIncome, onToggleIncomeReceived, onDeleteTransaction, onDeleteIncome }) {',
    'Transactions signature',
  );

  const movementsAnchor = "  const movements = summary.transactions.filter((transaction) => transaction.type !== 'expense').filter((transaction) => `${transaction.desc} ${SPECIAL_TRANSACTION_META[transaction.type]?.label || ''}`.toLowerCase().includes(text));";
  const choices = `${movementsAnchor}\n  const personChoices = (peopleOptions || []).filter((item) => item.id !== 'unassigned');\n  const accountChoicesFor = (personId) => (accountOptions || []).filter((account) => {\n    if (!account || account.id === 'unassigned') return false;\n    const ownerId = account.ownerId || 'unassigned';\n    if (!personId || personId === 'unassigned') return true;\n    if (personId === 'household') return ownerId === 'household' || ownerId === 'unassigned';\n    return ownerId === personId || ownerId === 'household' || ownerId === 'unassigned';\n  });`;
  app = replaceOnce(app, movementsAnchor, choices, 'Transactions assignment choice helpers');

  app = replaceOnce(
    app,
    "              accountMap={accountMap}\n              canEdit={canEdit}\n              onTogglePaid={onTogglePaid}\n              onEdit={onEditTransaction}\n              onDelete={onDeleteTransaction}",
    "              accountMap={accountMap}\n              peopleOptions={personChoices}\n              accountOptions={accountChoicesFor(transaction.paidBy)}\n              canEdit={canEdit}\n              onTogglePaid={onTogglePaid}\n              onEdit={onEditTransaction}\n              onAssign={onAssignTransaction}\n              onDelete={onDeleteTransaction}",
    'Expense row assignment props',
  );

  const oldIncomeLine = `                <div className="record-meta assignment-line">Received by <AssignmentValue value={record.receivedByLabel || peopleMap[record.receivedBy]?.label || record.receivedBy} unassigned={!record.receivedBy || record.receivedBy === 'unassigned'} fieldLabel="Received By" canEdit={canEdit} onAssign={() => onEditIncome(record, 'receivedBy')} /> <span aria-hidden="true">·</span> <AssignmentValue value={ownedRecordAccountLabel(record, accountMap, peopleMap)} unassigned={!record.account || record.account === 'unassigned'} fieldLabel="Account" canEdit={canEdit} onAssign={() => onEditIncome(record, 'account')} /></div>`;
  const newIncomeLine = `                <div className="record-meta assignment-line">Received by <AssignmentSelect value={record.receivedBy || 'unassigned'} displayValue={record.receivedByLabel || peopleMap[record.receivedBy]?.label || ''} placeholder="User" fieldLabel="Received by" options={personChoices} canEdit={canEdit} onAssign={(value) => onAssignIncome(record, 'receivedBy', value)} /> <span aria-hidden="true">·</span> <AssignmentSelect value={record.account || 'unassigned'} displayValue={ownedRecordAccountLabel(record, accountMap, peopleMap)} placeholder="Account" fieldLabel="Account" options={accountChoicesFor(record.receivedBy)} canEdit={canEdit} onAssign={(value) => onAssignIncome(record, 'account', value)} /></div>`;
  app = replaceOnce(app, oldIncomeLine, newIncomeLine, 'Income inline assignment controls');

  app = replaceOnce(
    app,
    'function ExpenseRow({ transaction, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEdit, onDelete }) {',
    'function ExpenseRow({ transaction, categoryMap, peopleMap, accountMap, peopleOptions, accountOptions, canEdit, onTogglePaid, onEdit, onAssign, onDelete }) {',
    'ExpenseRow signature',
  );

  const oldExpenseLine = `        <div className="record-meta assignment-line"><AssignmentValue value={transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || transaction.paidBy} unassigned={!transaction.paidBy || transaction.paidBy === 'unassigned'} fieldLabel="Paid By" canEdit={canEdit} onAssign={() => onEdit(transaction, 'paidBy')} /> <span aria-hidden="true">·</span> <AssignmentValue value={accountLabel} unassigned={!transaction.account || transaction.account === 'unassigned'} fieldLabel="Account" canEdit={canEdit} onAssign={() => onEdit(transaction, 'account')} /></div>`;
  const newExpenseLine = `        <div className="record-meta assignment-line">Paid by <AssignmentSelect value={transaction.paidBy || 'unassigned'} displayValue={transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || ''} placeholder="User" fieldLabel="Paid by" options={peopleOptions} canEdit={canEdit} onAssign={(value) => onAssign(transaction, 'paidBy', value)} /> <span aria-hidden="true">·</span> <AssignmentSelect value={transaction.account || 'unassigned'} displayValue={accountLabel} placeholder="Account" fieldLabel="Account" options={accountOptions} canEdit={canEdit} onAssign={(value) => onAssign(transaction, 'account', value)} /></div>`;
  app = replaceOnce(app, oldExpenseLine, newExpenseLine, 'Expense inline assignment controls');

  const oldAssignmentValue = `function AssignmentValue({ value, unassigned, fieldLabel, canEdit, onAssign }) {\n  if (!unassigned) return <span>{value}</span>;\n  return <button type="button" className="assignment-warning" disabled={!canEdit} aria-label={\`Assign ${fieldLabel}\`} onClick={onAssign}>Unassigned</button>;\n}`;
  const newAssignmentSelect = `function AssignmentSelect({ value, displayValue, placeholder, fieldLabel, options = [], canEdit, onAssign }) {\n  const currentValue = value && value !== 'unassigned' ? value : 'unassigned';\n  const unassigned = currentValue === 'unassigned';\n  const label = unassigned ? placeholder : displayValue || options.find((item) => item.id === currentValue)?.displayLabel || options.find((item) => item.id === currentValue)?.label || currentValue;\n  if (!canEdit) return <span className={unassigned ? 'assignment-static-warning' : undefined}>{label}</span>;\n  const hasCurrentOption = options.some((item) => item.id === currentValue);\n  return (\n    <select\n      className={\`assignment-select${unassigned ? ' is-unassigned' : ''}\`}\n      aria-label={\`Select ${fieldLabel}\`}\n      value={currentValue}\n      onChange={(event) => onAssign(event.target.value)}\n    >\n      <option value="unassigned">{placeholder}</option>\n      {!unassigned && !hasCurrentOption && <option value={currentValue}>{label}</option>}\n      {options.filter((item) => item.id !== 'unassigned').map((item) => (\n        <option key={item.id} value={item.id}>{item.displayLabel || item.label}</option>\n      ))}\n    </select>\n  );\n}`;
  app = replaceOnce(app, oldAssignmentValue, newAssignmentSelect, 'AssignmentSelect component');

  await writeFile(appPath, app);
}

const monthSetupPath = 'src/month-setup.js';
let monthSetup = await readFile(monthSetupPath, 'utf8');
if (!monthSetup.includes('PENNY_V84_ROLLOVER_REFERENCES')) {
  if (!monthSetup.includes("from './month-scope.js'")) throw new Error('v84 requires v28 month-scoped setup before rollover repair.');

  monthSetup = monthSetup.replace('    compareText(transaction.paidBy),', '    compareText(transaction.paidByLabel || transaction.paidBy),');
  monthSetup = monthSetup.replace('    compareText(record.receivedBy),\n    compareText(record.account),', '    compareText(record.receivedByLabel || record.receivedBy),\n    compareText(record.accountLabel || record.account),');

  const billStart = monthSetup.indexOf('export function buildRecurringBillCopies(');
  const incomeStart = monthSetup.indexOf('export function buildRecurringIncomeCopies(', billStart);
  const setupCopiesStart = monthSetup.indexOf('export function buildMonthSetupCopies(', incomeStart);
  if (!(billStart >= 0 && incomeStart > billStart && setupCopiesStart > incomeStart)) throw new Error('v84 could not isolate month-copy functions.');

  const helpers = `// PENNY_V84_ROLLOVER_REFERENCES\nfunction normaliseReferenceEvidence(value) {\n  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\\s+/g, ' ');\n}\n\nfunction setupAccountOwnerCompatible(account, ownerId) {\n  if (!account || !ownerId || ownerId === 'unassigned') return true;\n  const accountOwnerId = account.ownerId || 'unassigned';\n  if (ownerId === 'household') return accountOwnerId === 'household' || accountOwnerId === 'unassigned';\n  return accountOwnerId === ownerId || accountOwnerId === 'household' || accountOwnerId === 'unassigned';\n}\n\nfunction setupReferenceLists(state, sourceMonthKey, targetMonthKey) {\n  const sourcePeople = getMonthPeople(state, sourceMonthKey);\n  const sourceAccounts = getMonthAccounts(state, sourceMonthKey);\n  const targetPeople = state?.peopleByMonth && Object.hasOwn(state.peopleByMonth, targetMonthKey)\n    ? getMonthPeople(state, targetMonthKey)\n    : [];\n  const targetAccounts = state?.accountsByMonth && Object.hasOwn(state.accountsByMonth, targetMonthKey)\n    ? getMonthAccounts(state, targetMonthKey)\n    : [];\n  return {\n    people: targetPeople.length ? targetPeople : sourcePeople,\n    accounts: targetAccounts.length ? targetAccounts : sourceAccounts,\n  };\n}\n\nfunction resolveSetupPerson(personId, personLabel, people) {\n  if (personId === 'household') return 'household';\n  if (personId && personId !== 'unassigned' && people.some((person) => person.id === personId)) return personId;\n  const evidence = normaliseReferenceEvidence(personLabel);\n  if (!evidence) return 'unassigned';\n  if (evidence === 'joint' || evidence === 'household') return 'household';\n  const matches = people.filter((person) => normaliseReferenceEvidence(person.label) === evidence);\n  return matches.length === 1 ? matches[0].id : 'unassigned';\n}\n\nfunction setupPersonLabel(personId, fallback, people) {\n  if (personId === 'household') return 'Joint';\n  return people.find((person) => person.id === personId)?.label || fallback || '';\n}\n\nfunction resolveSetupAccount(record, ownerId, accounts) {\n  const direct = accounts.find((account) => account.id === record.account && setupAccountOwnerCompatible(account, ownerId));\n  if (direct) return direct;\n  const evidence = [record.accountLabel, record.legacyAccountLabel].map(normaliseReferenceEvidence).filter(Boolean);\n  const matches = new Map();\n  accounts.filter((account) => setupAccountOwnerCompatible(account, ownerId)).forEach((account) => {\n    const candidate = normaliseReferenceEvidence(account.label);\n    if (!candidate) return;\n    if (evidence.some((label) => label === candidate || (label.length >= 4 && candidate.length >= 4 && (label.includes(candidate) || candidate.includes(label))))) {\n      matches.set(account.id, account);\n    }\n  });\n  if (matches.size === 1) return [...matches.values()][0];\n  if (matches.size > 1) return null;\n  if (ownerId && ownerId !== 'unassigned' && ownerId !== 'household') {\n    const owned = accounts.filter((account) => setupAccountOwnerCompatible(account, ownerId) && account.ownerId === ownerId);\n    if (owned.length === 1) return owned[0];\n  }\n  return null;\n}\n\n`;

  const billFunction = `export function buildRecurringBillCopies(state, targetMonthKey, selectedIds, idFactory = createId) {\n  const setup = recurringBillSetup(state, targetMonthKey);\n  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);\n  const refs = setupReferenceLists(state, setup.sourceMonthKey, targetMonthKey);\n  return setup.candidates.flatMap(({ id, transaction, duplicate }) => {\n    if (duplicate || !selected.has(id)) return [];\n    const paidBy = resolveSetupPerson(transaction.paidBy, transaction.paidByLabel, refs.people);\n    const paidByLabel = setupPersonLabel(paidBy, transaction.paidByLabel, refs.people);\n    const resolvedAccount = resolveSetupAccount(transaction, paidBy, refs.accounts);\n    const copiedAccountId = resolvedAccount?.id || 'unassigned';\n    const ownerId = resolvedAccount?.ownerId || 'unassigned';\n    const copied = normaliseTransaction({\n      ...transaction,\n      id: idFactory('txn'),\n      date: recurringTargetDate(transaction.date, targetMonthKey),\n      paid: false,\n      paidBy,\n      paidByLabel,\n      account: copiedAccountId,\n      accountLabel: resolvedAccount?.label || '',\n      accountOwnerId: ownerId,\n      accountOwnerLabel: setupPersonLabel(ownerId, '', refs.people),\n      confirmationIssues: ['date', ...(transaction.confirmationIssues || []).filter((issue) => issue === 'other'), ...(paidBy === 'unassigned' ? ['paidBy'] : []), ...(!resolvedAccount ? ['account'] : [])],\n      dateConfirmed: false,\n      needsConfirmation: true,\n      source: 'month_copy',\n    }, state?.customCats || []);\n    return copied ? [copied] : [];\n  });\n}\n\n`;

  const incomeFunction = `export function buildRecurringIncomeCopies(state, targetMonthKey, selectedIds, idFactory = createId) {\n  const setup = recurringBillSetup(state, targetMonthKey);\n  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);\n  const refs = setupReferenceLists(state, setup.sourceMonthKey, targetMonthKey);\n  return setup.incomeCandidates.flatMap(({ id, record, mode, duplicate }) => {\n    if (duplicate || !selected.has(id)) return [];\n    const receivedBy = resolveSetupPerson(record.receivedBy, record.receivedByLabel, refs.people);\n    const receivedByLabel = setupPersonLabel(receivedBy, record.receivedByLabel, refs.people);\n    const resolvedAccount = resolveSetupAccount(record, receivedBy, refs.accounts);\n    const copiedAccountId = resolvedAccount?.id || 'unassigned';\n    const ownerId = resolvedAccount?.ownerId || 'unassigned';\n    const amountConfirmed = mode === 'fixed';\n    const confirmationIssues = ['date', 'received', ...(amountConfirmed ? [] : ['amount'])];\n    if (receivedBy === 'unassigned') confirmationIssues.push('receivedBy');\n    if (!resolvedAccount) confirmationIssues.push('account');\n    const copied = normaliseIncomeRecord({\n      ...record,\n      id: idFactory('income'),\n      date: recurringTargetDate(record.date, targetMonthKey),\n      amount: amountConfirmed ? record.amount : 0,\n      amountConfirmed,\n      incomeStatus: 'expected',\n      recurrenceMode: mode,\n      receivedBy,\n      receivedByLabel,\n      account: copiedAccountId,\n      accountLabel: resolvedAccount?.label || '',\n      accountOwnerId: ownerId,\n      accountOwnerLabel: setupPersonLabel(ownerId, '', refs.people),\n      confirmationIssues,\n      dateConfirmed: false,\n      needsConfirmation: true,\n      source: 'month_copy',\n    }, targetMonthKey);\n    return copied ? [copied] : [];\n  });\n}\n\n`;

  monthSetup = monthSetup.slice(0, billStart) + helpers + billFunction + incomeFunction + monthSetup.slice(setupCopiesStart);
  await writeFile(monthSetupPath, monthSetup);
}

const stylesPath = 'src/styles.css';
let styles = await readFile(stylesPath, 'utf8');
if (!styles.includes('PENNY_V84_ASSIGNMENT_SELECT')) {
  styles += `\n\n/* PENNY_V84_ASSIGNMENT_SELECT */\n.assignment-select {\n  min-height: 28px;\n  max-width: min(210px, 46vw);\n  border: 1px solid var(--border-soft);\n  border-radius: 999px;\n  padding: 3px 24px 3px 9px;\n  background: var(--surface-2);\n  color: var(--text);\n  font: inherit;\n  font-weight: 760;\n  line-height: 1.3;\n}\n.assignment-select.is-unassigned {\n  border-color: rgba(245,185,66,0.62);\n  background: rgba(245,185,66,0.12);\n  color: var(--amber);\n  font-weight: 800;\n}\n.assignment-select:disabled { cursor: not-allowed; opacity: 0.72; }\n.assignment-static-warning { color: var(--amber); font-weight: 800; }\n@media (max-width: 480px) {\n  .assignment-select { max-width: 42vw; font-size: 11px; }\n}\n`;
  await writeFile(stylesPath, styles);
}

const sourceAuditPath = 'scripts/source-audit.mjs';
let sourceAudit = await readFile(sourceAuditPath, 'utf8');
sourceAudit = sourceAudit.split('\n').map((line) => {
  if (line.includes('Income Detail must expose an actionable recipient assignment.')) {
    return "  assert.match(files.app, /onAssignIncome\\(record, 'receivedBy', value\\)/, 'Income Detail must expose an actionable recipient assignment.');";
  }
  if (line.includes('Income Detail must expose an actionable receiving-account assignment.')) {
    return "  assert.match(files.app, /onAssignIncome\\(record, 'account', value\\)/, 'Income Detail must expose an actionable receiving-account assignment.');";
  }
  return line;
}).join('\n');
await writeFile(sourceAuditPath, sourceAudit);

console.log('PENNY_V84 inline assignments and month rollover references applied');
