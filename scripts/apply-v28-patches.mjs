import { readFile, writeFile } from 'node:fs/promises';

async function patchFile(path, transform) {
  const before = await readFile(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    if (before.includes('PENNY_V28_MONTH_SCOPED')) return;
    throw new Error(`v28 patch made no change to ${path}`);
  }
  await writeFile(path, after);
}

function once(text, search, replacement, label) {
  const index = text.indexOf(search);
  if (index < 0) {
    if (text.includes(replacement)) return text;
    throw new Error(`Missing v28 patch anchor: ${label}`);
  }
  if (text.indexOf(search, index + search.length) >= 0) throw new Error(`Ambiguous v28 patch anchor: ${label}`);
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

function all(text, search, replacement, label, minimum = 1) {
  const count = text.split(search).length - 1;
  if (count < minimum) {
    if (text.includes(replacement)) return text;
    throw new Error(`Missing v28 repeated patch anchor: ${label}`);
  }
  return text.split(search).join(replacement);
}

await patchFile('src/finance.js', (input) => {
  let text = input;
  text = once(text,
    "import { BASE_CATEGORIES, SPECIAL_ACCOUNTS, SPECIAL_PEOPLE } from './catalog.js';",
    "import { BASE_CATEGORIES, SPECIAL_ACCOUNTS, SPECIAL_PEOPLE } from './catalog.js';\nimport { migrateMonthScopedSetup } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED",
    'finance month-scope import');
  text = once(text, 'export const CURRENT_STATE_VERSION = 10;', 'export const CURRENT_STATE_VERSION = 11;', 'state version');
  text = once(text,
    "    people: [],\n    accounts: [],\n    savingsByMonth: {},",
    "    people: [],\n    accounts: [],\n    peopleByMonth: {},\n    accountsByMonth: {},\n    hiddenCatsByMonth: {},\n    savingsByMonth: {},",
    'blank month references');
  text = once(text,
    "  const people = normaliseReferenceList(saved.people, 'person');\n  const accounts = normaliseReferenceList(saved.accounts, 'account');\n  const bankBalancesByMonth = normaliseBankBalancesByMonth(saved.bankBalancesByMonth);\n  ({ txnsByMonth, incomeByMonth } = snapshotReferenceLabels(txnsByMonth, incomeByMonth, people, accounts));",
    "  const people = normaliseReferenceList(saved.people, 'person');\n  const accounts = normaliseReferenceList(saved.accounts, 'account');\n  const bankBalancesByMonth = normaliseBankBalancesByMonth(saved.bankBalancesByMonth);\n  ({ txnsByMonth, incomeByMonth } = snapshotReferenceLabels(txnsByMonth, incomeByMonth, people, accounts));\n  const { peopleByMonth, accountsByMonth, hiddenCatsByMonth } = migrateMonthScopedSetup(saved, { currentKey, people, accounts });",
    'migrate month references');
  text = once(text,
    "    people,\n    accounts,\n    savingsByMonth:",
    "    people,\n    accounts,\n    peopleByMonth,\n    accountsByMonth,\n    hiddenCatsByMonth,\n    savingsByMonth:",
    'return month references');
  return text;
});

await patchFile('src/state.js', (input) => {
  let text = input;
  text = once(text,
    "import { recurringBillKey, recurringIncomeKey } from './month-setup.js';",
    "import { recurringBillKey, recurringIncomeKey } from './month-setup.js';\nimport { cloneMonthSetup, getMonthAccounts, setMonthList } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED",
    'state month-scope import');
  text = once(text,
    "      const sourceBudget = isValidMonthKey(action.sourceMonthKey) ? state.budgetsByMonth?.[action.sourceMonthKey] : null;\n      const copyBudget = sourceBudget && !state.budgetsByMonth?.[action.monthKey];\n      if (!copiedBills.length && !copiedIncome.length && !copyBudget) return state;\n      const next = {\n        ...state,\n        txnsByMonth: copiedBills.length ? { ...state.txnsByMonth, [action.monthKey]: sortByDate([...copiedBills, ...existingTxns]) } : state.txnsByMonth,\n        incomeByMonth: copiedIncome.length ? { ...state.incomeByMonth, [action.monthKey]: sortByDate([...copiedIncome, ...existingIncome]) } : state.incomeByMonth,\n        budgetsByMonth: copyBudget ? { ...state.budgetsByMonth, [action.monthKey]: { ...sourceBudget } } : state.budgetsByMonth,\n      };",
    "      const setupCopy = cloneMonthSetup(state, action.sourceMonthKey, action.monthKey, action);\n      const sourceBudget = isValidMonthKey(action.sourceMonthKey) ? state.budgetsByMonth?.[action.sourceMonthKey] : null;\n      const copyBudget = Boolean(action.copyBudget && sourceBudget);\n      if (!copiedBills.length && !copiedIncome.length && !copyBudget && !Object.keys(setupCopy).length) return state;\n      const next = {\n        ...state,\n        txnsByMonth: copiedBills.length ? { ...state.txnsByMonth, [action.monthKey]: sortByDate([...copiedBills, ...existingTxns]) } : state.txnsByMonth,\n        incomeByMonth: copiedIncome.length ? { ...state.incomeByMonth, [action.monthKey]: sortByDate([...copiedIncome, ...existingIncome]) } : state.incomeByMonth,\n        peopleByMonth: Object.hasOwn(setupCopy, 'people') ? setMonthList(state.peopleByMonth, action.monthKey, setupCopy.people) : state.peopleByMonth,\n        accountsByMonth: Object.hasOwn(setupCopy, 'accounts') ? setMonthList(state.accountsByMonth, action.monthKey, setupCopy.accounts) : state.accountsByMonth,\n        hiddenCatsByMonth: Object.hasOwn(setupCopy, 'hiddenCats') ? setMonthList(state.hiddenCatsByMonth, action.monthKey, setupCopy.hiddenCats, (items) => [...items]) : state.hiddenCatsByMonth,\n        bankBalancesByMonth: Object.hasOwn(setupCopy, 'bankBalances') ? withoutEmptyMonth(state.bankBalancesByMonth, action.monthKey, setupCopy.bankBalances) : state.bankBalancesByMonth,\n        savingsByMonth: Object.hasOwn(setupCopy, 'savings') ? withoutEmptyMonth(state.savingsByMonth, action.monthKey, setupCopy.savings) : state.savingsByMonth,\n        budgetsByMonth: copyBudget ? { ...state.budgetsByMonth, [action.monthKey]: { ...sourceBudget } } : state.budgetsByMonth,\n      };",
    'start month scoped setup');
  text = once(text,
    "        after: { sourceMonthKey: action.sourceMonthKey || '', copiedBills, copiedIncome, copiedBudget: Boolean(copyBudget) },",
    "        after: { sourceMonthKey: action.sourceMonthKey || '', copiedBills, copiedIncome, copiedBudget: Boolean(copyBudget), copiedPeople: Boolean(action.copyPeople || action.copyAccounts), copiedAccounts: Boolean(action.copyAccounts), copiedCategories: Boolean(action.copyCategories), copiedBankBalances: Boolean(action.copyBankBalances), copiedSavings: Boolean(action.copySavings) },",
    'start month audit');
  text = once(text, '      const accounts = [...state.accounts];', '      const accounts = [...getMonthAccounts(state, action.monthKey)];', 'split month accounts');
  text = once(text,
    "        ...state,\n        accounts,\n        txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: sortByDate(nextRows) },",
    "        ...state,\n        accountsByMonth: setMonthList(state.accountsByMonth, action.monthKey, accounts),\n        txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: sortByDate(nextRows) },",
    'split write month accounts');
  text = once(text,
    "    case 'TOGGLE_HIDE': {\n      const hidden = state.hiddenCats.includes(action.id);\n      const next = {\n        ...state,\n        hiddenCats: hidden ? state.hiddenCats.filter((id) => id !== action.id) : [...state.hiddenCats, action.id],\n      };\n      return appendAudit(next, action, { action: hidden ? 'show' : 'hide', entityType: 'category', entityId: action.id, label: action.id });\n    }\n    case 'SET_REFERENCE_LIST': {",
    "    case 'TOGGLE_HIDE': {\n      const currentHidden = isValidMonthKey(action.monthKey) ? (state.hiddenCatsByMonth?.[action.monthKey] ?? state.hiddenCats ?? []) : state.hiddenCats;\n      const hidden = currentHidden.includes(action.id);\n      const nextHidden = hidden ? currentHidden.filter((id) => id !== action.id) : [...currentHidden, action.id];\n      const next = isValidMonthKey(action.monthKey)\n        ? { ...state, hiddenCatsByMonth: setMonthList(state.hiddenCatsByMonth, action.monthKey, nextHidden, (items) => [...items]) }\n        : { ...state, hiddenCats: nextHidden };\n      return appendAudit(next, action, { action: hidden ? 'show' : 'hide', entityType: 'category', entityId: action.id, monthKey: action.monthKey, label: action.id });\n    }\n    case 'SET_MONTH_REFERENCE_LIST': {\n      if (!isValidMonthKey(action.monthKey) || !['people', 'accounts'].includes(action.field) || !Array.isArray(action.items)) return state;\n      const mapField = action.field === 'people' ? 'peopleByMonth' : 'accountsByMonth';\n      const before = state[mapField]?.[action.monthKey] ?? state[action.field] ?? [];\n      const items = action.field === 'accounts' ? action.items.map((item) => ({ ...item, ownerId: item?.ownerId || 'unassigned' })) : action.items;\n      const next = { ...state, [mapField]: setMonthList(state[mapField], action.monthKey, items) };\n      return appendAudit(next, action, { action: 'update', entityType: action.field, monthKey: action.monthKey, label: action.field === 'people' ? 'Household people' : 'Accounts', before, after: items });\n    }\n    case 'SET_REFERENCE_LIST': {",
    'month settings reducer');
  return text;
});

await patchFile('src/month-setup.js', (input) => {
  let text = input;
  text = once(text,
    "} from './finance.js';",
    "} from './finance.js';\nimport { getMonthAccounts, getMonthPeople } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED",
    'month setup import');
  text = once(text,
    "  const accountIds = new Set((state?.accounts || []).map((account) => account.id));",
    "  const accountIds = new Set(getMonthAccounts(state, sourceMonthKey).map((account) => account.id));",
    'source account availability');
  text = all(text,
    "  const people = Object.fromEntries((state?.people || []).map((person) => [person.id, person]));\n  const accounts = Object.fromEntries((state?.accounts || []).map((account) => [account.id, account]));",
    "  const people = Object.fromEntries(getMonthPeople(state, setup.sourceMonthKey).map((person) => [person.id, person]));\n  const accounts = Object.fromEntries(getMonthAccounts(state, setup.sourceMonthKey).map((account) => [account.id, account]));",
    'recurring source refs', 2);
  return text;
});

await patchFile('src/storage.js', (input) => {
  let text = input;
  text = once(text,
    "} from './finance.js';",
    "} from './finance.js';\nimport { getMonthAccounts, getMonthHiddenCats, getMonthPeople } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED",
    'storage month-scope import');
  text = once(text,
    "  'accounts',\n  'savingsByMonth',",
    "  'accounts',\n  'peopleByMonth',\n  'accountsByMonth',\n  'hiddenCatsByMonth',\n  'savingsByMonth',",
    'known scope fields');
  text = once(text,
    "export function createBackupText(state, now = new Date()) {\n  return JSON.stringify({\n    app: 'Penny',\n    formatVersion: CURRENT_STATE_VERSION,\n    exportedAt: now.toISOString(),\n    state,\n  }, null, 2);\n}",
    "function monthOnlyState(state, monthKey) {\n  const blank = createBlankState();\n  const pick = (record) => record?.[monthKey] == null ? {} : { [monthKey]: record[monthKey] };\n  const people = getMonthPeople(state, monthKey);\n  const accounts = getMonthAccounts(state, monthKey);\n  const hiddenCats = getMonthHiddenCats(state, monthKey);\n  return {\n    ...blank,\n    version: CURRENT_STATE_VERSION,\n    customCats: state.customCats || [],\n    hiddenCats, people, accounts,\n    peopleByMonth: { [monthKey]: people },\n    accountsByMonth: { [monthKey]: accounts },\n    hiddenCatsByMonth: { [monthKey]: hiddenCats },\n    txnsByMonth: pick(state.txnsByMonth),\n    incomeByMonth: pick(state.incomeByMonth),\n    savingsByMonth: pick(state.savingsByMonth),\n    bankBalancesByMonth: pick(state.bankBalancesByMonth),\n    monthMetaByMonth: pick(state.monthMetaByMonth),\n    budgetsByMonth: pick(state.budgetsByMonth),\n    auditLog: (state.auditLog || []).filter((entry) => entry.monthKey === monthKey),\n  };\n}\n\nexport function createBackupText(state, now = new Date(), options = {}) {\n  const monthKey = isValidMonthKey(options.monthKey) ? options.monthKey : '';\n  const scope = options.scope === 'month' && monthKey ? 'month' : 'all';\n  const exportedState = scope === 'month' ? monthOnlyState(state, monthKey) : state;\n  return JSON.stringify({\n    app: 'Penny',\n    formatVersion: CURRENT_STATE_VERSION,\n    exportedAt: now.toISOString(),\n    scope,\n    ...(scope === 'month' ? { months: [monthKey], importMode: 'merge_months', mergeMonths: [monthKey] } : { importMode: 'replace' }),\n    state: exportedState,\n  }, null, 2);\n}",
    'scoped backup export');
  text = once(text,
    "  const requestedMonths = Array.isArray(parsed.mergeMonths)\n    ? [...new Set(parsed.mergeMonths.filter(isValidMonthKey))]\n    : [];\n  const importMode = parsed.importMode === 'merge_months' && requestedMonths.length ? 'merge_months' : 'replace';\n  return { state, importMode, mergeMonths: importMode === 'merge_months' ? requestedMonths : [] };",
    "  const requestedMonths = Array.isArray(parsed.months)\n    ? [...new Set(parsed.months.filter(isValidMonthKey))]\n    : Array.isArray(parsed.mergeMonths) ? [...new Set(parsed.mergeMonths.filter(isValidMonthKey))] : [];\n  const monthScoped = parsed.scope === 'month' && requestedMonths.length;\n  const importMode = (monthScoped || parsed.importMode === 'merge_months') && requestedMonths.length ? 'merge_months' : 'replace';\n  return { state, scope: importMode === 'merge_months' ? 'month' : 'all', importMode, mergeMonths: importMode === 'merge_months' ? requestedMonths : [] };",
    'scope-aware parser');
  text = once(text,
    "  const budgetsByMonth = { ...current.budgetsByMonth };",
    "  const budgetsByMonth = { ...current.budgetsByMonth };\n  const peopleByMonth = { ...(current.peopleByMonth || {}) };\n  const accountsByMonth = { ...(current.accountsByMonth || {}) };\n  const hiddenCatsByMonth = { ...(current.hiddenCatsByMonth || {}) };",
    'merge month setup maps');
  text = once(text,
    "    if (incoming.budgetsByMonth[monthKey]) budgetsByMonth[monthKey] = incoming.budgetsByMonth[monthKey];\n    else delete budgetsByMonth[monthKey];",
    "    if (incoming.budgetsByMonth[monthKey]) budgetsByMonth[monthKey] = incoming.budgetsByMonth[monthKey];\n    else delete budgetsByMonth[monthKey];\n    peopleByMonth[monthKey] = getMonthPeople(incoming, monthKey);\n    accountsByMonth[monthKey] = getMonthAccounts(incoming, monthKey);\n    hiddenCatsByMonth[monthKey] = getMonthHiddenCats(incoming, monthKey);",
    'merge selected month setup');
  text = once(text,
    "    budgetsByMonth,\n    customCats: mergeById(current.customCats, incoming.customCats),\n    people: mergeById(current.people, incoming.people),\n    accounts: mergeAccountsById(current.accounts, incoming.accounts),\n    auditLog: mergeAuditLogs(current.auditLog, incoming.auditLog),",
    "    budgetsByMonth,\n    peopleByMonth,\n    accountsByMonth,\n    hiddenCatsByMonth,\n    customCats: mergeById(current.customCats, incoming.customCats),\n    auditLog: mergeAuditLogs(current.auditLog, incoming.auditLog),",
    'preserve other month setup on import');
  return text;
});

await patchFile('src/App.jsx', (input) => {
  let text = input;
  text = once(text,
    "import { overviewActionableIncompleteCount } from './overview-status.js';",
    "import { overviewActionableIncompleteCount } from './overview-status.js';\nimport { getMonthAccounts, getMonthHiddenCats, getMonthPeople } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED",
    'App month-scope import');
  text = once(text,
    "  const visibleCategories = allCategories.filter((category) => !state.hiddenCats.includes(category.id));\n  const categoryMap = useMemo(() => makeCategoryMap(state.customCats), [state.customCats]);\n  const peopleOptions = useMemo(() => [...state.people, ...SPECIAL_PEOPLE], [state.people]);\n  const peopleMap = useMemo(() => makeReferenceMap(state.people, SPECIAL_PEOPLE), [state.people]);\n  const accountOwnerOptions = useMemo(() => [...state.people, { id: 'household', label: 'Joint' }, { id: 'unassigned', label: 'TBC' }], [state.people]);\n  const accountOptions = useMemo(() => [\n    ...state.accounts.map((account) => ({",
    "  const monthPeople = useMemo(() => getMonthPeople(state, monthKey), [state, monthKey]);\n  const monthAccounts = useMemo(() => getMonthAccounts(state, monthKey), [state, monthKey]);\n  const monthHiddenCats = useMemo(() => getMonthHiddenCats(state, monthKey), [state, monthKey]);\n  const visibleCategories = allCategories.filter((category) => !monthHiddenCats.includes(category.id));\n  const categoryMap = useMemo(() => makeCategoryMap(state.customCats), [state.customCats]);\n  const peopleOptions = useMemo(() => [...monthPeople, ...SPECIAL_PEOPLE], [monthPeople]);\n  const peopleMap = useMemo(() => makeReferenceMap(monthPeople, SPECIAL_PEOPLE), [monthPeople]);\n  const accountOwnerOptions = useMemo(() => [...monthPeople, { id: 'household', label: 'Joint' }, { id: 'unassigned', label: 'TBC' }], [monthPeople]);\n  const accountOptions = useMemo(() => [\n    ...monthAccounts.map((account) => ({",
    'App month refs');
  text = once(text,
    "  ], [state.accounts, peopleMap]);\n  const accountMap = useMemo(() => makeReferenceMap(state.accounts, SPECIAL_ACCOUNTS), [state.accounts]);\n  const monthUnlocked = unlockedMonths.has(monthKey);\n  const canEditMonth = !recoveryRequired && (!summary.isComplete || monthUnlocked);",
    "  ], [monthAccounts, peopleMap]);\n  const accountMap = useMemo(() => makeReferenceMap(monthAccounts, SPECIAL_ACCOUNTS), [monthAccounts]);\n  const monthUnlocked = unlockedMonths.has(monthKey);\n  const canEditMonth = !recoveryRequired && (!summary.isComplete || monthUnlocked);\n  const monthScopedSettingsState = useMemo(() => ({ ...state, people: monthPeople, accounts: monthAccounts, hiddenCats: monthHiddenCats }), [state, monthPeople, monthAccounts, monthHiddenCats]);\n  const mutateMonthSettings = (action) => {\n    if (action.type === 'SET_REFERENCE_LIST') return mutate({ ...action, type: 'SET_MONTH_REFERENCE_LIST', monthKey });\n    if (action.type === 'TOGGLE_HIDE') return mutate({ ...action, monthKey });\n    return mutate(action);\n  };",
    'App settings facade');
  text = once(text, "    const account = state.accounts.find((item) => item.id === accountId);", "    const account = monthAccounts.find((item) => item.id === accountId);", 'balance month account');
  text = once(text, "    const peopleLabels = Object.fromEntries(state.people.map((person) => [person.id, person.label]));", "    const peopleLabels = Object.fromEntries(monthPeople.map((person) => [person.id, person.label]));", 'split month people');
  text = once(text,
    "  const exportBackup = () => {\n    if (recoveryRequired) {\n      setMessage('Normal backup export is disabled while storage recovery is required because the in-memory fallback is not the unreadable saved data. Import a valid backup or erase the damaged local copy first.');\n      return;\n    }\n    const blob = new Blob([createBackupText(state)], { type: 'application/json' });\n    const url = URL.createObjectURL(blob);\n    const anchor = document.createElement('a');\n    anchor.href = url;\n    anchor.download = `penny-backup-${localDateKey()}.json`;\n    document.body.appendChild(anchor);\n    anchor.click();\n    anchor.remove();\n    URL.revokeObjectURL(url);\n  };",
    "  const exportBackup = (options = { scope: 'all' }) => {\n    if (recoveryRequired) {\n      setMessage('Normal backup export is disabled while storage recovery is required because the in-memory fallback is not the unreadable saved data. Import a valid backup or erase the damaged local copy first.');\n      return;\n    }\n    const exportMonthKey = options.scope === 'month' && isValidMonthKey(options.monthKey) ? options.monthKey : '';\n    const blob = new Blob([createBackupText(state, new Date(), exportMonthKey ? { scope: 'month', monthKey: exportMonthKey } : { scope: 'all' })], { type: 'application/json' });\n    const url = URL.createObjectURL(blob);\n    const anchor = document.createElement('a');\n    anchor.href = url;\n    anchor.download = exportMonthKey ? `penny-${exportMonthKey}-backup-${localDateKey()}.json` : `penny-full-backup-${localDateKey()}.json`;\n    document.body.appendChild(anchor);\n    anchor.click();\n    anchor.remove();\n    URL.revokeObjectURL(url);\n  };",
    'scoped export handler');
  text = once(text,
    "    const copies = buildMonthSetupCopies(state, monthKey, selection);\n    if (!copies.bills.length && !copies.income.length) {",
    "    const copies = buildMonthSetupCopies(state, monthKey, selection);\n    const setupSelected = selection.copyPeople || selection.copyAccounts || selection.copyBudget || selection.copyCategories || selection.copyBankBalances || selection.copySavings;\n    if (!copies.bills.length && !copies.income.length && !setupSelected) {",
    'start month setup selection');
  text = once(text,
    "      bills: copies.bills,\n      income: copies.income,\n      auditLabel:",
    "      bills: copies.bills,\n      income: copies.income,\n      copyPeople: Boolean(selection.copyPeople || selection.copyAccounts),\n      copyAccounts: Boolean(selection.copyAccounts),\n      copyBudget: Boolean(selection.copyBudget),\n      copyCategories: Boolean(selection.copyCategories),\n      copyBankBalances: Boolean(selection.copyBankBalances),\n      copySavings: Boolean(selection.copySavings),\n      auditLabel:",
    'start month flags');
  text = once(text,
    "          state={state}\n          allCategories={allCategories}",
    "          state={monthScopedSettingsState}\n          monthKey={monthKey}\n          allCategories={allCategories}",
    'settings scoped state');
  text = once(text, "          mutate={mutate}\n          fileRef={fileRef}", "          mutate={mutateMonthSettings}\n          fileRef={fileRef}", 'settings scoped mutate');
  text = once(text,
    "function SettingsModal({ state, allCategories, accountOwnerOptions, recoveryRequired, rollbackAvailable, mutate, fileRef, onImport, onExport, onRestorePreviousImport, onErase, onClose }) {\n  const runningVersion",
    "function SettingsModal({ state, monthKey, allCategories, accountOwnerOptions, recoveryRequired, rollbackAvailable, mutate, fileRef, onImport, onExport, onRestorePreviousImport, onErase, onClose }) {\n  const [exportScope, setExportScope] = useState('current');\n  const [exportMonth, setExportMonth] = useState(monthKey);\n  const runningVersion",
    'settings export state');
  text = once(text,
    "          <button className=\"primary-button\" disabled={recoveryRequired} title={recoveryRequired ? 'Unavailable during storage recovery' : 'Export Penny backup'} onClick={onExport}>Export backup</button>\n          <button className=\"secondary-button\" onClick={() => fileRef.current?.click()}>Import backup</button>",
    "          <select aria-label=\"Export scope\" value={exportScope} disabled={recoveryRequired} onChange={(event) => setExportScope(event.target.value)}><option value=\"current\">Export current month</option><option value=\"choose\">Export a specific month</option><option value=\"all\">Export all Penny data</option></select>\n          {exportScope === 'choose' && <input aria-label=\"Month to export\" type=\"month\" value={exportMonth} onChange={(event) => setExportMonth(event.target.value)} />}\n          <button className=\"primary-button\" disabled={recoveryRequired || (exportScope === 'choose' && !isValidMonthKey(exportMonth))} title={recoveryRequired ? 'Unavailable during storage recovery' : 'Export selected Penny backup'} onClick={() => onExport(exportScope === 'all' ? { scope: 'all' } : { scope: 'month', monthKey: exportScope === 'current' ? monthKey : exportMonth })}>Export selected backup</button>\n          <button className=\"secondary-button\" onClick={() => fileRef.current?.click()}>Import backup</button>",
    'settings export UI');
  text = once(text,
    "function StartNewMonthModal({ setup, targetMonthKey, peopleMap, accountMap, onConfirm, onClose }) {\n  const [selectedBills, setSelectedBills] = useState(() => new Set(setup.candidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id)));\n  const [selectedIncome, setSelectedIncome] = useState(() => new Set(setup.incomeCandidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id)));",
    "function StartNewMonthModal({ setup, targetMonthKey, peopleMap, accountMap, onConfirm, onClose }) {\n  const [selectedBills, setSelectedBills] = useState(() => new Set(setup.candidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id)));\n  const [selectedIncome, setSelectedIncome] = useState(() => new Set(setup.incomeCandidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id)));\n  const [copyPeople, setCopyPeople] = useState(true);\n  const [copyAccounts, setCopyAccounts] = useState(true);\n  const [copyBudget, setCopyBudget] = useState(true);\n  const [copyCategories, setCopyCategories] = useState(true);\n  const [copyBankBalances, setCopyBankBalances] = useState(false);\n  const [copySavings, setCopySavings] = useState(false);",
    'new month option state');
  text = once(text,
    "      <p className=\"section-note\">Carry forward planning records from {sourceLabel}. Bills start Unpaid. Regular income starts Expected. Child Benefit and Child Maintenance keep the previous amount; pay and variable benefits carry forward with Amount TBC until confirmed. Actual day-to-day spending, transfers and bank balances are never copied.</p>\n      <h3>Recurring bills</h3>",
    "      <p className=\"section-note\">Choose exactly what to carry forward from {sourceLabel}. Every copied section becomes an independent {targetLabel} copy. Ordinary spending, refunds, transfers, card repayments and one-off income are never copied.</p>\n      <h3>Month setup</h3>\n      <div className=\"month-setup-list\">\n        <label className=\"month-setup-row\"><input type=\"checkbox\" checked={copyPeople} onChange={(event) => { setCopyPeople(event.target.checked); if (!event.target.checked) setCopyAccounts(false); }} /><div className=\"grow\"><div className=\"row-title\">Household people</div><div className=\"muted\">Independent people list for this month</div></div></label>\n        <label className=\"month-setup-row\"><input type=\"checkbox\" checked={copyAccounts} onChange={(event) => { setCopyAccounts(event.target.checked); if (event.target.checked) setCopyPeople(true); }} /><div className=\"grow\"><div className=\"row-title\">Accounts + owners</div><div className=\"muted\">Copies account names and ownership</div></div></label>\n        <label className=\"month-setup-row\"><input type=\"checkbox\" checked={copyBudget} onChange={(event) => setCopyBudget(event.target.checked)} /><div className=\"grow\"><div className=\"row-title\">Budget setup</div></div></label>\n        <label className=\"month-setup-row\"><input type=\"checkbox\" checked={copyCategories} onChange={(event) => setCopyCategories(event.target.checked)} /><div className=\"grow\"><div className=\"row-title\">Category setup</div></div></label>\n        <label className=\"month-setup-row\"><input type=\"checkbox\" checked={copyBankBalances} onChange={(event) => setCopyBankBalances(event.target.checked)} /><div className=\"grow\"><div className=\"row-title\">Current bank balances</div><div className=\"muted\">Off by default — use only if the prior snapshot is the correct starting point</div></div></label>\n        <label className=\"month-setup-row\"><input type=\"checkbox\" checked={copySavings} onChange={(event) => setCopySavings(event.target.checked)} /><div className=\"grow\"><div className=\"row-title\">Savings snapshot</div><div className=\"muted\">Off by default</div></div></label>\n      </div>\n      <button type=\"button\" className=\"secondary-button full-width\" onClick={() => { setCopyPeople(true); setCopyAccounts(true); setCopyBudget(true); setCopyCategories(true); setCopyBankBalances(false); setCopySavings(false); setSelectedBills(new Set(setup.candidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id))); setSelectedIncome(new Set(setup.incomeCandidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id))); }}>Select all reusable setup</button>\n      <h3>Recurring bills</h3>",
    'new month setup options');
  text = once(text,
    "      <div className=\"actions\"><button className=\"secondary-button\" onClick={onClose}>Cancel</button><button className=\"primary-button\" disabled={selectedCount === 0} onClick={() => onConfirm({ billIds: [...selectedBills], incomeIds: [...selectedIncome] })}>Set Up Month</button></div>",
    "      <div className=\"actions\"><button className=\"secondary-button\" onClick={onClose}>Cancel</button><button className=\"primary-button\" disabled={selectedCount === 0 && !copyPeople && !copyAccounts && !copyBudget && !copyCategories && !copyBankBalances && !copySavings} onClick={() => onConfirm({ billIds: [...selectedBills], incomeIds: [...selectedIncome], copyPeople, copyAccounts, copyBudget, copyCategories, copyBankBalances, copySavings })}>Set Up Month</button></div>",
    'new month confirmation');
  return text;
});

await patchFile('src/category-settings-cleanup.js', (input) => {
  let text = input;
  text = once(text,
    "    'Global setup — kept when you clear a month. A person can be removed once they no longer own an active account. Historical records keep the person details already saved with them.',",
    "    'Month setup — applies to the selected month only. Other months keep their own household people. Historical records keep the person details already saved with them.', // PENNY_V28_MONTH_SCOPED",
    'people scope wording');
  text = once(text,
    "    'Global setup — kept when you clear a month. Removing an account removes it from future choices; historical records keep their saved account evidence.',",
    "    'Month setup — applies to the selected month only. Removing or changing an account here does not change any other month; saved records retain their account evidence.',",
    'account scope wording');
  text = once(text,
    "    'Global setup — kept when you clear a month. Hide built-in categories you do not want to use; unused custom categories can be deleted.',",
    "    'Category visibility is month-specific. Custom category definitions stay available for historical evidence and can be deleted only when unused.',",
    'category scope wording');
  return text;
});

console.log('PENNY_V28_MONTH_SCOPED patches applied');
