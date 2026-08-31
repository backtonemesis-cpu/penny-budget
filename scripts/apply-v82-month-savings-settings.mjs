import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/App.jsx';
let text = await readFile(path, 'utf8');

if (!/\bmonthKey=\{monthKey\}/.test(text.slice(text.indexOf('<SettingsModal'), text.indexOf('<SettingsModal') + 500))) {
  const next = text.replace(/(<SettingsModal\s*\n\s*state=\{state\})/, '$1\n          monthKey={monthKey}');
  if (next === text) throw new Error('v82 missing anchor: Settings monthKey prop');
  text = next;
}

if (!text.includes('function SettingsModal({ state, monthKey,')) {
  const next = text.replace('function SettingsModal({ state, ', 'function SettingsModal({ state, monthKey, ');
  if (next === text) throw new Error('v82 missing anchor: SettingsModal signature');
  text = next;
}

const legacySection = `          <section className="settings-section">\n            <h3>Savings Accounts</h3>\n            <p className="section-note">Reusable savings-account names for monthly snapshots. Removing a name from Settings does not rewrite historical month snapshots.</p>\n            <ReferenceEditor field="savingsAccounts" items={state.savingsAccounts || []} state={state} mutate={mutate} placeholder="Savings account name" />\n          </section>`;
const monthlySection = `          <section className="settings-section">\n            <MonthSavingsSettings state={state} monthKey={monthKey} mutate={mutate} />\n          </section>`;
if (!text.includes(monthlySection)) {
  if (!text.includes(legacySection)) throw new Error('v82 missing anchor: legacy Savings Accounts settings');
  text = text.replace(legacySection, monthlySection);
}

if (!text.includes('function MonthSavingsSettings({ state, monthKey, mutate })')) {
  const anchor = '\nfunction ReferenceEditor({ field, items, state, mutate, placeholder }) {';
  if (!text.includes(anchor)) throw new Error('v82 missing anchor: ReferenceEditor');
  const component = `\nfunction MonthSavingsSettings({ state, monthKey, mutate }) {\n  const items = state.savingsByMonth?.[monthKey] || [];\n  const [newLabel, setNewLabel] = useState('');\n  const setItems = (nextItems, auditLabel) => mutate({ type: 'SET_SAVINGS_ACCOUNTS', monthKey, items: nextItems, auditLabel });\n  const add = () => {\n    const label = newLabel.trim();\n    if (!label) return;\n    if (items.some((item) => item.label.trim().toLowerCase() === label.toLowerCase())) return;\n    setItems([...items, { id: createId('saving_account'), label: label.slice(0, 80), balance: 0 }], 'Add ' + label + ' savings account for ' + monthKey);\n    setNewLabel('');\n  };\n  const update = (id, value) => {\n    const label = value.trim();\n    if (!label) return;\n    const before = items.find((item) => item.id === id);\n    if (!before || before.label === label) return;\n    setItems(items.map((item) => item.id === id ? { ...item, label: label.slice(0, 80) } : item), 'Rename ' + before.label + ' savings account for ' + monthKey);\n  };\n  const remove = (id) => {\n    const before = items.find((item) => item.id === id);\n    if (!before) return;\n    if (before.balance > 0 && !globalThis.confirm('Remove ' + before.label + ' with a recorded balance of ' + formatMoney(before.balance) + ' from this month?')) return;\n    setItems(items.filter((item) => item.id !== id), 'Remove ' + before.label + ' savings account from ' + monthKey);\n  };\n  return (\n    <>\n      <h3>Savings Accounts</h3>\n      {items.map((item) => (\n        <ReferenceRowEditor\n          key={item.id}\n          item={item}\n          inUse={false}\n          onCommit={(label) => update(item.id, label)}\n          onRemove={() => remove(item.id)}\n        />\n      ))}\n      <div className="settings-row">\n        <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Savings account name" aria-label="Savings account name" />\n        <button className="primary-button" disabled={!newLabel.trim()} onClick={add}>Add</button>\n      </div>\n    </>\n  );\n}\n`;
  text = text.replace(anchor, component + anchor);
}

await writeFile(path, text);
console.log('v82 month-scoped Savings Accounts settings applied');
