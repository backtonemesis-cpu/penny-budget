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
  const handlers = `  // PENNY_V84_INLINE_ASSIGNMENT
  const assignmentOwnerCompatible = (account, personId) => {
    if (!account || account.id === 'unassigned' || !personId || personId === 'unassigned') return true;
    const ownerId = account.ownerId || 'unassigned';
    if (personId === 'household') return ownerId === 'household' || ownerId === 'unassigned';
    return ownerId === personId || ownerId === 'household' || ownerId === 'unassigned';
  };

  const assignExpenseReference = (transaction, field, value) => {
    if (!canEditMonth) {
      setMessage('This month is locked. Unlock corrections before changing assignments.');
      return;
    }
    const nextValue = value || 'unassigned';
    let draft = { ...transaction };
    if (field === 'paidBy') {
      const person = peopleOptions.find((item) => item.id === nextValue);
      draft.paidBy = nextValue;
      draft.paidByLabel = nextValue === 'unassigned' ? '' : person?.label || '';
      const currentAccount = accountOptions.find((item) => item.id === draft.account);
      if (currentAccount && !assignmentOwnerCompatible(currentAccount, nextValue)) {
        draft.account = 'unassigned';
        draft.accountLabel = '';
        draft.accountOwnerId = 'unassigned';
        draft.accountOwnerLabel = '';
      }
    } else if (field === 'account') {
      const account = accountOptions.find((item) => item.id === nextValue);
      if (nextValue !== 'unassigned' && !account) {
        setMessage('That account is not available for this month.');
        return;
      }
      if (account && !assignmentOwnerCompatible(account, draft.paidBy)) {
        setMessage('Choose an account that matches the selected payer.');
        return;
      }
      draft.account = nextValue;
      draft.accountLabel = nextValue === 'unassigned' ? '' : account?.label || '';
      draft.accountOwnerId = nextValue === 'unassigned' ? 'unassigned' : account?.ownerId || 'unassigned';
      draft.accountOwnerLabel = nextValue === 'unassigned' ? '' : peopleOptions.find((item) => item.id === account?.ownerId)?.label || '';
    } else return;
    const next = normaliseTransaction(draft, state.customCats);
    if (!next) return;
    mutate({ type: 'UPDATE_TXN', monthKey: transaction.date.slice(0, 7), txn: next, auditLabel: 'Assign ' + transaction.desc + ' ' + (field === 'paidBy' ? 'payer' : 'account') });
  };

  const assignIncomeReference = (record, field, value) => {
    if (!canEditMonth) {
      setMessage('This month is locked. Unlock corrections before changing assignments.');
      return;
    }
    const nextValue = value || 'unassigned';
    let draft = { ...record };
    if (field === 'receivedBy') {
      const person = peopleOptions.find((item) => item.id === nextValue);
      draft.receivedBy = nextValue;
      draft.receivedByLabel = nextValue === 'unassigned' ? '' : person?.label || '';
      const currentAccount = accountOptions.find((item) => item.id === draft.account);
      if (currentAccount && !assignmentOwnerCompatible(currentAccount, nextValue)) {
        draft.account = 'unassigned';
        draft.accountLabel = '';
        draft.accountOwnerId = 'unassigned';
        draft.accountOwnerLabel = '';
      }
    } else if (field === 'account') {
      const account = accountOptions.find((item) => item.id === nextValue);
      if (nextValue !== 'unassigned' && !account) {
        setMessage('That account is not available for this month.');
        return;
      }
      if (account && !assignmentOwnerCompatible(account, draft.receivedBy)) {
        setMessage('Choose an account that matches the selected recipient.');
        return;
      }
      draft.account = nextValue;
      draft.accountLabel = nextValue === 'unassigned' ? '' : account?.label || '';
      draft.accountOwnerId = nextValue === 'unassigned' ? 'unassigned' : account?.ownerId || 'unassigned';
      draft.accountOwnerLabel = nextValue === 'unassigned' ? '' : peopleOptions.find((item) => item.id === account?.ownerId)?.label || '';
    } else return;
    const next = normaliseIncomeRecord(draft, record.date.slice(0, 7));
    if (!next) return;
    mutate({ type: 'UPDATE_INCOME', monthKey: record.date.slice(0, 7), record: next, auditLabel: 'Assign ' + record.description + ' ' + (field === 'receivedBy' ? 'recipient' : 'account') });
  };

`;
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
  const choices = `${movementsAnchor}
  const personChoices = (peopleOptions || []).filter((item) => item.id !== 'unassigned');
  const accountChoicesFor = (personId) => (accountOptions || []).filter((account) => {
    if (!account || account.id === 'unassigned') return false;
    const ownerId = account.ownerId || 'unassigned';
    if (!personId || personId === 'unassigned') return true;
    if (personId === 'household') return ownerId === 'household' || ownerId === 'unassigned';
    return ownerId === personId || ownerId === 'household' || ownerId === 'unassigned';
  });`;
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

  const oldAssignmentValue = 'function AssignmentValue({ value, unassigned, fieldLabel, canEdit, onAssign }) {\n  if (!unassigned) return <span>{value}</span>;\n  return <button type="button" className="assignment-warning" disabled={!canEdit} aria-label={`Assign ${fieldLabel}`} onClick={onAssign}>Unassigned</button>;\n}';
  const newAssignmentSelect = `function AssignmentSelect({ value, displayValue, placeholder, fieldLabel, options = [], canEdit, onAssign }) {
  const currentValue = value && value !== 'unassigned' ? value : 'unassigned';
  const unassigned = currentValue === 'unassigned';
  const label = unassigned ? placeholder : displayValue || options.find((item) => item.id === currentValue)?.displayLabel || options.find((item) => item.id === currentValue)?.label || currentValue;
  if (!canEdit) return <span className={unassigned ? 'assignment-static-warning' : undefined}>{label}</span>;
  const hasCurrentOption = options.some((item) => item.id === currentValue);
  return (
    <select
      className={'assignment-select' + (unassigned ? ' is-unassigned' : '')}
      aria-label={'Select ' + fieldLabel}
      value={currentValue}
      onChange={(event) => onAssign(event.target.value)}
    >
      <option value="unassigned">{placeholder}</option>
      {!unassigned && !hasCurrentOption && <option value={currentValue}>{label}</option>}
      {options.filter((item) => item.id !== 'unassigned').map((item) => (
        <option key={item.id} value={item.id}>{item.displayLabel || item.label}</option>
      ))}
    </select>
  );
}`;
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

  const helpers = `// PENNY_V84_ROLLOVER_REFERENCES
function normaliseReferenceEvidence(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\\s+/g, ' ');
}

function setupAccountOwnerCompatible(account, ownerId) {
  if (!account || !ownerId || ownerId === 'unassigned') return true;
  const accountOwnerId = account.ownerId || 'unassigned';
  if (ownerId === 'household') return accountOwnerId === 'household' || accountOwnerId === 'unassigned';
  return accountOwnerId === ownerId || accountOwnerId === 'household' || accountOwnerId === 'unassigned';
}

function setupReferenceLists(state, sourceMonthKey, targetMonthKey) {
  const sourcePeople = getMonthPeople(state, sourceMonthKey);
  const sourceAccounts = getMonthAccounts(state, sourceMonthKey);
  const targetPeople = state?.peopleByMonth && Object.hasOwn(state.peopleByMonth, targetMonthKey)
    ? getMonthPeople(state, targetMonthKey)
    : [];
  const targetAccounts = state?.accountsByMonth && Object.hasOwn(state.accountsByMonth, targetMonthKey)
    ? getMonthAccounts(state, targetMonthKey)
    : [];
  return {
    people: targetPeople.length ? targetPeople : sourcePeople,
    accounts: targetAccounts.length ? targetAccounts : sourceAccounts,
  };
}

function resolveSetupPerson(personId, personLabel, people) {
  if (personId === 'household') return 'household';
  if (personId && personId !== 'unassigned' && people.some((person) => person.id === personId)) return personId;
  const evidence = normaliseReferenceEvidence(personLabel);
  if (!evidence) return 'unassigned';
  if (evidence === 'joint' || evidence === 'household') return 'household';
  const matches = people.filter((person) => normaliseReferenceEvidence(person.label) === evidence);
  return matches.length === 1 ? matches[0].id : 'unassigned';
}

function setupPersonLabel(personId, fallback, people) {
  if (personId === 'household') return 'Joint';
  return people.find((person) => person.id === personId)?.label || fallback || '';
}

function resolveSetupAccount(record, ownerId, accounts) {
  const direct = accounts.find((account) => account.id === record.account && setupAccountOwnerCompatible(account, ownerId));
  if (direct) return direct;
  const evidence = [record.accountLabel, record.legacyAccountLabel].map(normaliseReferenceEvidence).filter(Boolean);
  const matches = new Map();
  accounts.filter((account) => setupAccountOwnerCompatible(account, ownerId)).forEach((account) => {
    const candidate = normaliseReferenceEvidence(account.label);
    if (!candidate) return;
    if (evidence.some((label) => label === candidate || (label.length >= 4 && candidate.length >= 4 && (label.includes(candidate) || candidate.includes(label))))) {
      matches.set(account.id, account);
    }
  });
  if (matches.size === 1) return [...matches.values()][0];
  if (matches.size > 1) return null;
  if (ownerId && ownerId !== 'unassigned' && ownerId !== 'household') {
    const owned = accounts.filter((account) => setupAccountOwnerCompatible(account, ownerId) && account.ownerId === ownerId);
    if (owned.length === 1) return owned[0];
  }
  return null;
}

`;

  const billFunction = `export function buildRecurringBillCopies(state, targetMonthKey, selectedIds, idFactory = createId) {
  const setup = recurringBillSetup(state, targetMonthKey);
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const refs = setupReferenceLists(state, setup.sourceMonthKey, targetMonthKey);
  return setup.candidates.flatMap(({ id, transaction, duplicate }) => {
    if (duplicate || !selected.has(id)) return [];
    const paidBy = resolveSetupPerson(transaction.paidBy, transaction.paidByLabel, refs.people);
    const paidByLabel = setupPersonLabel(paidBy, transaction.paidByLabel, refs.people);
    const resolvedAccount = resolveSetupAccount(transaction, paidBy, refs.accounts);
    const copiedAccountId = resolvedAccount?.id || 'unassigned';
    const ownerId = resolvedAccount?.ownerId || 'unassigned';
    const copied = normaliseTransaction({
      ...transaction,
      id: idFactory('txn'),
      date: recurringTargetDate(transaction.date, targetMonthKey),
      paid: false,
      paidBy,
      paidByLabel,
      account: copiedAccountId,
      accountLabel: resolvedAccount?.label || '',
      accountOwnerId: ownerId,
      accountOwnerLabel: setupPersonLabel(ownerId, '', refs.people),
      confirmationIssues: ['date', ...(transaction.confirmationIssues || []).filter((issue) => issue === 'other'), ...(paidBy === 'unassigned' ? ['paidBy'] : []), ...(!resolvedAccount ? ['account'] : [])],
      dateConfirmed: false,
      needsConfirmation: true,
      source: 'month_copy',
    }, state?.customCats || []);
    return copied ? [copied] : [];
  });
}

`;

  const incomeFunction = `export function buildRecurringIncomeCopies(state, targetMonthKey, selectedIds, idFactory = createId) {
  const setup = recurringBillSetup(state, targetMonthKey);
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const refs = setupReferenceLists(state, setup.sourceMonthKey, targetMonthKey);
  return setup.incomeCandidates.flatMap(({ id, record, mode, duplicate }) => {
    if (duplicate || !selected.has(id)) return [];
    const receivedBy = resolveSetupPerson(record.receivedBy, record.receivedByLabel, refs.people);
    const receivedByLabel = setupPersonLabel(receivedBy, record.receivedByLabel, refs.people);
    const resolvedAccount = resolveSetupAccount(record, receivedBy, refs.accounts);
    const copiedAccountId = resolvedAccount?.id || 'unassigned';
    const ownerId = resolvedAccount?.ownerId || 'unassigned';
    const amountConfirmed = mode === 'fixed';
    const confirmationIssues = ['date', 'received', ...(amountConfirmed ? [] : ['amount'])];
    if (receivedBy === 'unassigned') confirmationIssues.push('receivedBy');
    if (!resolvedAccount) confirmationIssues.push('account');
    const copied = normaliseIncomeRecord({
      ...record,
      id: idFactory('income'),
      date: recurringTargetDate(record.date, targetMonthKey),
      amount: amountConfirmed ? record.amount : 0,
      amountConfirmed,
      incomeStatus: 'expected',
      recurrenceMode: mode,
      receivedBy,
      receivedByLabel,
      account: copiedAccountId,
      accountLabel: resolvedAccount?.label || '',
      accountOwnerId: ownerId,
      accountOwnerLabel: setupPersonLabel(ownerId, '', refs.people),
      confirmationIssues,
      dateConfirmed: false,
      needsConfirmation: true,
      source: 'month_copy',
    }, targetMonthKey);
    return copied ? [copied] : [];
  });
}

`;

  monthSetup = monthSetup.slice(0, billStart) + helpers + billFunction + incomeFunction + monthSetup.slice(setupCopiesStart);
  await writeFile(monthSetupPath, monthSetup);
}

const stylesPath = 'src/styles.css';
let styles = await readFile(stylesPath, 'utf8');
if (!styles.includes('PENNY_V84_ASSIGNMENT_SELECT')) {
  styles += `

/* PENNY_V84_ASSIGNMENT_SELECT */
.assignment-select {
  min-height: 28px;
  max-width: min(210px, 46vw);
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  padding: 3px 24px 3px 9px;
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-weight: 760;
  line-height: 1.3;
}
.assignment-select.is-unassigned {
  border-color: rgba(245,185,66,0.62);
  background: rgba(245,185,66,0.12);
  color: var(--amber);
  font-weight: 800;
}
.assignment-select:disabled { cursor: not-allowed; opacity: 0.72; }
.assignment-static-warning { color: var(--amber); font-weight: 800; }
@media (max-width: 480px) {
  .assignment-select { max-width: 42vw; font-size: 11px; }
}
`;
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
