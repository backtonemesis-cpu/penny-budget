import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(text, search, replacement, label) {
  if (text.includes(replacement)) return text;
  const index = text.indexOf(search);
  if (index < 0) throw new Error(`v80 missing anchor: ${label}`);
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

const path = 'src/App.jsx';
let text = await readFile(path, 'utf8');

if (!/\bmonthKey=\{monthKey\}/.test(text.slice(text.indexOf('<SettingsModal'), text.indexOf('<SettingsModal') + 500))) {
  const next = text.replace(/(<SettingsModal\s*\n\s*state=\{state\})/, '$1\n          monthKey={monthKey}');
  if (next === text) throw new Error('v80 missing anchor: Settings monthKey prop');
  text = next;
}

if (!text.includes('function SettingsModal({ state, monthKey,')) {
  const next = text.replace('function SettingsModal({ state, ', 'function SettingsModal({ state, monthKey, ');
  if (next === text) throw new Error('v80 missing anchor: SettingsModal signature');
  text = next;
}

const globalSavingsSettings = `          <section className="settings-section">\n            <h3>Savings Accounts</h3>\n            <p className="section-note">Reusable savings-account names for monthly snapshots. Removing a name from Settings does not rewrite historical month snapshots.</p>\n            <ReferenceEditor field="savingsAccounts" items={state.savingsAccounts || []} state={state} mutate={mutate} placeholder="Savings account name" />\n          </section>`;
const monthSavingsSettings = `          <section className="settings-section">\n            <SavingsSettingsEditor state={state} monthKey={monthKey} mutate={mutate} />\n          </section>`;
text = replaceOnce(text, globalSavingsSettings, monthSavingsSettings, 'month-scoped Savings Accounts settings');

if (!text.includes('function SavingsSettingsEditor({ state, monthKey, mutate })')) {
  const anchor = '\nfunction ReferenceEditor({ field, items, state, mutate, placeholder }) {';
  const component = `\nfunction SavingsSettingsEditor({ state, monthKey, mutate }) {\n  const items = state.savingsByMonth?.[monthKey] || [];\n  const [newLabel, setNewLabel] = useState('');\n  const setItems = (nextItems, auditLabel) => mutate({ type: 'SET_SAVINGS_ACCOUNTS', monthKey, items: nextItems, auditLabel });\n  const add = () => {\n    const label = newLabel.trim();\n    if (!label) return;\n    const duplicate = items.some((item) => item.label.trim().toLowerCase() === label.toLowerCase());\n    if (duplicate) return;\n    setItems([...items, { id: createId('saving_account'), label: label.slice(0, 80), balance: 0 }], 'Add ' + label + ' savings account for ' + monthKey);\n    setNewLabel('');\n  };\n  const update = (id, value) => {\n    const label = value.trim();\n    if (!label) return;\n    const before = items.find((item) => item.id === id);\n    if (!before || before.label === label) return;\n    setItems(items.map((item) => item.id === id ? { ...item, label: label.slice(0, 80) } : item), 'Rename ' + before.label + ' savings account for ' + monthKey);\n  };\n  const remove = (id) => {\n    const before = items.find((item) => item.id === id);\n    if (!before) return;\n    if (before.balance > 0 && !globalThis.confirm('Remove ' + before.label + ' with a recorded balance of ' + formatMoney(before.balance) + ' from this month?')) return;\n    setItems(items.filter((item) => item.id !== id), 'Remove ' + before.label + ' savings account from ' + monthKey);\n  };\n  return (\n    <>\n      <h3>Savings Accounts</h3>\n      {items.map((item) => (\n        <ReferenceRowEditor\n          key={item.id}\n          item={item}\n          inUse={false}\n          onCommit={(label) => update(item.id, label)}\n          onRemove={() => remove(item.id)}\n        />\n      ))}\n      <div className="settings-row">\n        <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Savings account name" aria-label="Savings account name" />\n        <button className="primary-button" disabled={!newLabel.trim()} onClick={add}>Add</button>\n      </div>\n    </>\n  );\n}\n`;
  text = replaceOnce(text, anchor, `${component}${anchor}`, 'SavingsSettingsEditor component');
}

text = text.replace(
  `  const masterSavingsAccounts = state.savingsAccounts || [];\n  const usedIds = new Set(savingsAccounts.map((item) => item.id));\n  const availableAccounts = masterSavingsAccounts.filter((item) => !usedIds.has(item.id));\n  const [adding, setAdding] = useState(false);\n  const [selectedAccountId, setSelectedAccountId] = useState('');`,
  `  const masterSavingsAccounts = savingsAccounts;\n  const availableAccounts = [];`,
);

text = text.replace(
  `          {canEdit && <button className="primary-button" disabled={!availableAccounts.length} onClick={() => { setAdding(true); setSelectedAccountId(availableAccounts[0]?.id || ''); }}>+ Add Account</button>}`,
  '',
);

const addPanelStart = `        {canEdit && adding && (\n          <div className="savings-add-panel">`;
const addPanelEnd = `          </div>\n        )}`;
const panelStartIndex = text.indexOf(addPanelStart);
if (panelStartIndex >= 0) {
  const panelEndIndex = text.indexOf(addPanelEnd, panelStartIndex);
  if (panelEndIndex < 0) throw new Error('v80 could not find the end of the v40 Savings add panel.');
  text = text.slice(0, panelStartIndex) + text.slice(panelEndIndex + addPanelEnd.length);
}

text = text.replace(
  `        {canEdit && !masterSavingsAccounts.length && <div className="empty savings-settings-hint">Add savings accounts in Settings first, then select them here.</div>}`,
  `        {canEdit && !savingsAccounts.length && <div className="empty savings-settings-hint">Add savings accounts for this month in Settings first.</div>}`,
);

await writeFile(path, text);
console.log('v80 month-scoped savings settings applied');
