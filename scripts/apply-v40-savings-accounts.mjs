import { readFile, writeFile } from 'node:fs/promises';

function once(text, search, replacement, label) {
  if (text.includes(replacement)) return text;
  const index = text.indexOf(search);
  if (index < 0) throw new Error(`v40 missing anchor: ${label}`);
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

// ---- State schema / migration -------------------------------------------------
{
  const path = 'src/finance.js';
  let text = await readFile(path, 'utf8');
  text = text.replace('export const CURRENT_STATE_VERSION = 11;', 'export const CURRENT_STATE_VERSION = 12;');
  text = once(
    text,
    '    hiddenCatsByMonth: {},\n    savingsByMonth: {},',
    '    hiddenCatsByMonth: {},\n    savingsAccounts: [],\n    savingsByMonth: {},',
    'blank savings master list',
  );

  const normaliserAnchor = `function normaliseSavingsByMonth(value) {`;
  if (!text.includes('function normaliseSavingsAccountReferences(')) {
    text = once(text, normaliserAnchor, `function normaliseSavingsAccountReferences(value) {\n  if (!Array.isArray(value)) return [];\n  const byId = new Map();\n  const byLabel = new Set();\n  value.forEach((item) => {\n    const id = cleanText(item?.id, '', 120);\n    const label = cleanText(item?.label, '', 80);\n    const labelKey = label.toLowerCase();\n    if (!id || !label || byId.has(id) || byLabel.has(labelKey)) return;\n    byId.set(id, { id, label });\n    byLabel.add(labelKey);\n  });\n  return [...byId.values()];\n}\n\n${normaliserAnchor}`, 'savings master normaliser');
  }

  const migrateAnchor = `  const people = normaliseReferenceList(saved.people, 'person');`;
  if (!text.includes('let savingsAccounts = normaliseSavingsAccountReferences(saved.savingsAccounts);')) {
    text = once(text, migrateAnchor, `  let savingsAccounts = normaliseSavingsAccountReferences(saved.savingsAccounts);\n  if (!savingsAccounts.length) {\n    const seenLabels = new Set();\n    savingsAccounts = Object.values(savingsByMonth).flat().flatMap((row) => {\n      const id = cleanText(row?.id, '', 120);\n      const label = cleanText(row?.label, '', 80);\n      const key = label.toLowerCase();\n      if (!id || !label || seenLabels.has(key)) return [];\n      seenLabels.add(key);\n      return [{ id, label }];\n    });\n  }\n  const savingsMasterById = new Map(savingsAccounts.map((item) => [item.id, item]));\n  const savingsMasterByLabel = new Map(savingsAccounts.map((item) => [item.label.toLowerCase(), item]));\n  savingsByMonth = Object.fromEntries(Object.entries(savingsByMonth).map(([monthKey, rows]) => [monthKey, rows.map((row) => {\n    const master = savingsMasterById.get(row.id) || savingsMasterByLabel.get(String(row.label || '').toLowerCase());\n    return master ? { ...row, id: master.id, label: row.label || master.label } : row;\n  })]));\n\n${migrateAnchor}`, 'derive savings master list');
  }

  text = once(
    text,
    '    hiddenCatsByMonth,\n    savingsByMonth,',
    '    hiddenCatsByMonth,\n    savingsAccounts,\n    savingsByMonth,',
    'return savings master list',
  );
  await writeFile(path, text);
}

// ---- Reducer ------------------------------------------------------------------
{
  const path = 'src/state.js';
  let text = await readFile(path, 'utf8');
  text = text.replace(
    "if (!['people', 'accounts'].includes(action.field) || !Array.isArray(action.items)) return state;",
    "if (!['people', 'accounts', 'savingsAccounts'].includes(action.field) || !Array.isArray(action.items)) return state;",
  );
  text = text.replace(
    "const items = action.field === 'accounts'\n        ? action.items.map((item) => ({ ...item, ownerId: item?.ownerId || 'unassigned' }))\n        : action.items;",
    "const items = action.field === 'accounts'\n        ? action.items.map((item) => ({ ...item, ownerId: item?.ownerId || 'unassigned' }))\n        : action.items;",
  );
  text = text.replace(
    "label: action.field === 'people' ? 'Household people' : 'Accounts'",
    "label: action.field === 'people' ? 'Household people' : action.field === 'accounts' ? 'Accounts' : 'Savings accounts'",
  );
  if (!text.includes("['people', 'accounts', 'savingsAccounts']")) throw new Error('v40 failed to enable savings account references.');
  await writeFile(path, text);
}

// ---- Scoped backup / import ---------------------------------------------------
{
  const path = 'src/storage.js';
  let text = await readFile(path, 'utf8');
  const monthStateAnchor = `    hiddenCatsByMonth: { [monthKey]: hiddenCats },\n    txnsByMonth: pick(state.txnsByMonth),`;
  if (!text.includes('savingsAccounts: (state.savingsAccounts || []).filter')) {
    text = once(text, monthStateAnchor, `    hiddenCatsByMonth: { [monthKey]: hiddenCats },\n    savingsAccounts: (state.savingsAccounts || []).filter((master) => (state.savingsByMonth?.[monthKey] || []).some((row) => row.id === master.id)),\n    txnsByMonth: pick(state.txnsByMonth),`, 'month backup savings references');
  }
  text = once(
    text,
    '    accounts: mergeAccountsById(current.accounts, incoming.accounts),\n    auditLog:',
    '    accounts: mergeAccountsById(current.accounts, incoming.accounts),\n    savingsAccounts: mergeById(current.savingsAccounts, incoming.savingsAccounts),\n    auditLog:',
    'merge imported savings references',
  );
  await writeFile(path, text);
}

// ---- App ----------------------------------------------------------------------
{
  const path = 'src/App.jsx';
  let text = await readFile(path, 'utf8');

  // Settings master list.
  if (!text.includes('<h3>Savings Accounts</h3>')) {
    const settingsAnchor = `          <section className="settings-section">\n            <CategoryManager categories={allCategories} state={state} mutate={mutate} />\n          </section>`;
    text = once(text, settingsAnchor, `          <section className="settings-section">\n            <h3>Savings Accounts</h3>\n            <p className="section-note">Reusable savings-account names for monthly snapshots. Removing a name from Settings does not rewrite historical month snapshots.</p>\n            <ReferenceEditor field="savingsAccounts" items={state.savingsAccounts || []} state={state} mutate={mutate} placeholder="Savings account name" />\n          </section>\n          <section className="settings-section">\n            <CategoryManager categories={allCategories} state={state} mutate={mutate} />\n          </section>`, 'Settings savings accounts section');
  }

  text = text.replace(
    "createId(field === 'people' ? 'person' : 'account')",
    "createId(field === 'people' ? 'person' : field === 'savingsAccounts' ? 'saving_account' : 'account')",
  );

  // Savings component receives the master list through state and uses it for Add.
  const signature = 'function Savings({ state, summary, monthKey, month, year, canEdit, mutate }) {';
  if (!text.includes('PENNY_V40_SAVINGS_MASTER')) {
    const start = text.indexOf(signature);
    if (start < 0) throw new Error('v40 could not find Savings component.');
    const editorStart = text.indexOf('\nfunction SavingsAccountEditor({', start);
    if (editorStart < 0) throw new Error('v40 could not find SavingsAccountEditor boundary.');
    const original = text.slice(start, editorStart);
    const bodyStart = original.indexOf('\n  return (');
    if (bodyStart < 0) throw new Error('v40 could not identify Savings return block.');
    const replacement = `function Savings({ state, summary, monthKey, month, year, canEdit, mutate }) {\n  // PENNY_V40_SAVINGS_MASTER\n  const savingsAccounts = state.savingsByMonth?.[monthKey] || [];\n  const masterSavingsAccounts = state.savingsAccounts || [];\n  const usedIds = new Set(savingsAccounts.map((item) => item.id));\n  const availableAccounts = masterSavingsAccounts.filter((item) => !usedIds.has(item.id));\n  const [adding, setAdding] = useState(false);\n  const [selectedAccountId, setSelectedAccountId] = useState('');\n  const setAccounts = (items, label = 'Update savings snapshot') => mutate({ type: 'SET_SAVINGS_ACCOUNTS', monthKey, items, auditLabel: label });\n  const addAccount = () => {\n    const account = masterSavingsAccounts.find((item) => item.id === selectedAccountId) || availableAccounts[0];\n    if (!account) return;\n    setAccounts([...savingsAccounts, { id: account.id, label: account.label, balance: 0 }], \`Add \\${account.label} savings snapshot\`);\n    setSelectedAccountId('');\n    setAdding(false);\n  };\n  const removeAccount = (id) => {\n    const account = savingsAccounts.find((item) => item.id === id);\n    if (!account) return;\n    if (!globalThis.confirm(\`Remove \\${account.label} from \\${MONTHS[month]} \\${year}? Other months and the Settings savings-account list will not be changed.\`)) return;\n    setAccounts(savingsAccounts.filter((item) => item.id !== id), \`Remove \\${account.label} from savings snapshot\`);\n  };\n  const updateAccount = (id, patch) => setAccounts(savingsAccounts.map((item) => item.id === id ? { ...item, ...patch } : item), 'Update savings account balance');\n\n  return (\n    <>\n      {!canEdit && summary.isComplete && <div className="status-banner">Completed savings snapshot is locked. Unlock corrections from Overview to edit it.</div>}\n      <section className="card income-detail-card savings-detail-card" aria-labelledby="savings-accounts-title">\n        <div className="section-heading income-detail-heading">\n          <div>\n            <h2 className="section-title" id="savings-accounts-title">Savings</h2>\n            <p className="section-note">Savings snapshot for {MONTHS[month]} {year}.</p>\n          </div>\n          {canEdit && <button className="primary-button" disabled={!availableAccounts.length} onClick={() => { setAdding(true); setSelectedAccountId(availableAccounts[0]?.id || ''); }}>+ Add Account</button>}\n        </div>\n        {canEdit && adding && (\n          <div className="savings-add-panel">\n            <label htmlFor="savings-account-select">Savings account</label>\n            <select id="savings-account-select" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>\n              {availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}\n            </select>\n            <div className="mini-actions">\n              <button className="secondary-button" onClick={() => setAdding(false)}>Cancel</button>\n              <button className="primary-button" disabled={!selectedAccountId && !availableAccounts.length} onClick={addAccount}>Add</button>\n            </div>\n          </div>\n        )}\n        {canEdit && !masterSavingsAccounts.length && <div className="empty savings-settings-hint">Add savings accounts in Settings first, then select them here.</div>}\n        {savingsAccounts.length ? savingsAccounts.map((account) => (\n          <SavingsAccountEditor\n            key={account.id}\n            account={account}\n            month={month}\n            year={year}\n            canEdit={canEdit}\n            onCommit={(patch) => updateAccount(account.id, patch)}\n            onRemove={() => removeAccount(account.id)}\n          />\n        )) : <div className="empty">No savings snapshot has been recorded for {MONTHS[month]} {year}.</div>}\n        <div className="total-line"><span>{summary.isComplete ? 'Closing Savings' : 'Savings Snapshot'}</span><span className="money green">{formatMoney(summary.currentSavings)}</span></div>\n      </section>\n    </>\n  );\n}\n`;
    text = text.slice(0, start) + replacement + text.slice(editorStart);
  }

  // Replace the v38 editor with a balance-only compact editor; the account identity comes from Settings.
  if (!text.includes('PENNY_V40_SAVINGS_EDITOR')) {
    const start = text.indexOf('function SavingsAccountEditor({');
    if (start < 0) throw new Error('v40 could not find SavingsAccountEditor.');
    const nextFunction = text.indexOf('\nfunction ', start + 20);
    if (nextFunction < 0) throw new Error('v40 could not find SavingsAccountEditor end.');
    const replacement = `function SavingsAccountEditor({ account, month, year, canEdit, onCommit, onRemove }) {\n  // PENNY_V40_SAVINGS_EDITOR\n  const [editing, setEditing] = useState(false);\n  const [balance, setBalance] = useState(String(account.balance || ''));\n  useEffect(() => setBalance(String(account.balance || '')), [account.balance]);\n  const save = () => {\n    if (!canEdit) return;\n    const nextBalance = Math.max(0, Number(balance) || 0);\n    if (nextBalance !== account.balance) onCommit({ balance: nextBalance });\n    setEditing(false);\n  };\n  return (\n    <div className="record-row income-detail-row savings-detail-row">\n      <div className="record-main">\n        <div className="record-title">{account.label}</div>\n        <div className="record-meta">{MONTHS[month]} {year} savings snapshot</div>\n        <div className="pill-line"><span className="status-pill success">Recorded</span></div>\n        {editing && (\n          <div className="savings-balance-edit">\n            <label htmlFor={\`saving-balance-\${account.id}\`}>Balance</label>\n            <input id={\`saving-balance-\${account.id}\`} type="number" inputMode="decimal" min="0" step="0.01" value={balance} placeholder="0.00" onChange={(event) => setBalance(event.target.value)} />\n          </div>\n        )}\n      </div>\n      <div className="record-side">\n        {!editing && <div className="money green">{formatMoney(account.balance)}</div>}\n        {canEdit && (\n          <div className="mini-actions savings-actions">\n            {editing ? (\n              <>\n                <button className="secondary-button" onClick={() => { setBalance(String(account.balance || '')); setEditing(false); }}>Cancel</button>\n                <button className="primary-button" onClick={save}>Save</button>\n              </>\n            ) : <button className="secondary-button" onClick={() => setEditing(true)}>Edit</button>}\n            <button className="danger-button" onClick={onRemove}>Delete</button>\n          </div>\n        )}\n      </div>\n    </div>\n  );\n}\n`;
    text = text.slice(0, start) + replacement + text.slice(nextFunction + 1);
  }

  // Overview Savings Snapshot must be actionable and explicitly routed to Savings.
  if (!text.includes("onSavingsDetails={() => setView('Savings')}")) {
    const anchor = '            onSeparateAccount={separateFundingAccount}';
    text = once(text, anchor, `            onSavingsDetails={() => setView('Savings')}\n${anchor}`, 'Overview savings route');
  }
  if (!text.includes('onClick={onSavingsDetails}')) {
    const heroAnchor = `          sub={summary.hasSavingsSnapshot ? \`${'${MONTHS[month]} ${year}'}\` : 'No savings snapshot recorded'}\n        />`;
    text = once(text, heroAnchor, `          sub={summary.hasSavingsSnapshot ? \`${'${MONTHS[month]} ${year}'}\` : 'No savings snapshot recorded'}\n          onClick={onSavingsDetails}\n        />`, 'Savings Snapshot click handler');
  }

  if (!text.includes('<h3>Savings Accounts</h3>') || !text.includes('PENNY_V40_SAVINGS_EDITOR') || !text.includes('onClick={onSavingsDetails}')) {
    throw new Error('v40 Savings UI installation incomplete.');
  }
  await writeFile(path, text);
}

console.log('PENNY_V40_SAVINGS_ACCOUNTS applied');
