import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/App.jsx';
let app = await readFile(path, 'utf8');

if (!app.includes('PENNY_V43_CLEAN_MONEY_TABS')) {
  const filterStart = app.indexOf('      {tab !== \'savings\' && (\n      <section className="card filter-card" aria-label="Transaction filters">');
  if (filterStart < 0) throw new Error('v43 could not find the Transactions filter panel installed before this cleanup.');
  const filterSectionEnd = app.indexOf('      </section>', filterStart);
  if (filterSectionEnd < 0) throw new Error('v43 could not find the end of the Transactions filter panel.');
  const filterWrapperEnd = app.indexOf('\n      )}', filterSectionEnd);
  if (filterWrapperEnd < 0) throw new Error('v43 could not find the filter-panel wrapper end.');
  app = app.slice(0, filterStart) + '      {/* PENNY_V43_CLEAN_MONEY_TABS: Income and Expenses intentionally show their records directly. */}' + app.slice(filterWrapperEnd + '\n      )}'.length);

  const savingsSetup = `  const usedIds = new Set(savingsAccounts.map((item) => item.id));\n  const availableAccounts = masterSavingsAccounts.filter((item) => !usedIds.has(item.id));\n  const [adding, setAdding] = useState(false);\n  const [selectedAccountId, setSelectedAccountId] = useState('');`;
  const savingsDisplay = `  const displayedSavingsAccounts = [\n    ...masterSavingsAccounts.map((master) => savingsAccounts.find((item) => item.id === master.id) || { ...master, balance: 0 }),\n    ...savingsAccounts.filter((item) => !masterSavingsAccounts.some((master) => master.id === item.id)),\n  ];`;
  if (!app.includes(savingsSetup)) throw new Error('v43 could not find Savings add-account state.');
  app = app.replace(savingsSetup, savingsDisplay);

  const addStart = app.indexOf('  const addAccount = () => {', app.indexOf('function Savings({'));
  const removeStart = app.indexOf('  const removeAccount = (id) => {', addStart);
  if (addStart < 0 || removeStart < 0) throw new Error('v43 could not isolate the old Savings add-account function.');
  app = app.slice(0, addStart) + app.slice(removeStart);

  const oldUpdate = `  const updateAccount = (id, patch) => setAccounts(savingsAccounts.map((item) => item.id === id ? { ...item, ...patch } : item), 'Update savings account balance');`;
  const newUpdate = `  const updateAccount = (id, patch) => {\n    const existing = savingsAccounts.find((item) => item.id === id);\n    const master = masterSavingsAccounts.find((item) => item.id === id);\n    if (existing) {\n      setAccounts(savingsAccounts.map((item) => item.id === id ? { ...item, ...patch } : item), 'Update savings account balance');\n      return;\n    }\n    if (master) setAccounts([...savingsAccounts, { id: master.id, label: master.label, balance: Math.max(0, Number(patch.balance) || 0) }], 'Record savings account balance');\n  };`;
  if (!app.includes(oldUpdate)) throw new Error('v43 could not find Savings balance update logic.');
  app = app.replace(oldUpdate, newUpdate);

  const addButton = `          {canEdit && <button className="primary-button" disabled={!availableAccounts.length} onClick={() => { setAdding(true); setSelectedAccountId(availableAccounts[0]?.id || ''); }}>+ Add Account</button>}\n`;
  if (!app.includes(addButton)) throw new Error('v43 could not find the Savings + Add Account button.');
  app = app.replace(addButton, '');

  const addPanelStart = app.indexOf('        {canEdit && adding && (');
  const nextSavingsHint = app.indexOf('        {canEdit && !masterSavingsAccounts.length', addPanelStart);
  if (addPanelStart < 0 || nextSavingsHint < 0) throw new Error('v43 could not find the Savings add-account panel boundaries.');
  app = app.slice(0, addPanelStart) + app.slice(nextSavingsHint);

  app = app.replace(
    '        {canEdit && !masterSavingsAccounts.length && <div className="empty savings-settings-hint">Add savings accounts in Settings first, then select them here.</div>}',
    '        {canEdit && !displayedSavingsAccounts.length && <div className="empty savings-settings-hint">Add savings accounts in Settings first.</div>}',
  );
  app = app.replace('        {savingsAccounts.length ? savingsAccounts.map((account) => (', '        {displayedSavingsAccounts.length ? displayedSavingsAccounts.map((account) => (');

  const onRemoveLine = '            onRemove={() => removeAccount(account.id)}\n';
  if (!app.includes(onRemoveLine)) throw new Error('v43 could not find monthly Savings delete wiring.');
  app = app.replace(onRemoveLine, '');

  app = app.replace(
    'function SavingsAccountEditor({ account, month, year, canEdit, onCommit, onRemove }) {',
    'function SavingsAccountEditor({ account, month, year, canEdit, onCommit }) {',
  );
  const deleteButton = '            <button className="danger-button" onClick={onRemove}>Delete</button>\n';
  if (!app.includes(deleteButton)) throw new Error('v43 could not find monthly Savings Delete button.');
  app = app.replace(deleteButton, '');
}

if (app.includes('aria-label="Transaction filters"')) throw new Error('v43 failed: Transactions filters are still rendered.');
if (app.includes('>+ Add Account</button>')) throw new Error('v43 failed: Savings still has a local Add Account button.');
if (app.includes('id="savings-account-select"')) throw new Error('v43 failed: Savings still has a local account selector.');
if (!app.includes('displayedSavingsAccounts')) throw new Error('v43 failed: Settings savings accounts are not represented in the Savings tab.');
if (!app.includes("field=\"savingsAccounts\"")) throw new Error('v43 failed: Settings savings-account management is missing.');

await writeFile(path, app);
console.log('PENNY_V43_CLEAN_MONEY_TABS applied');
