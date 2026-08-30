import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

// Overview: the Savings Snapshot hero is a navigation card, just like Income and Expenses.
if (!app.includes('onSavingsDetails={() => setView(\'Savings\')}')) {
  const invocationAnchor = '            onSeparateAccount={separateFundingAccount}';
  if (!app.includes(invocationAnchor)) throw new Error('v38 could not find Overview invocation anchor.');
  app = app.replace(invocationAnchor, `            onSavingsDetails={() => setView('Savings')}\n${invocationAnchor}`);
}

if (!app.includes('onExpenseDetails, onSavingsDetails, onSeparateAccount')) {
  if (app.includes('onExpenseDetails, onSeparateAccount')) {
    app = app.replace('onExpenseDetails, onSeparateAccount', 'onExpenseDetails, onSavingsDetails, onSeparateAccount');
  } else if (app.includes('onAddExpense, onSeparateAccount')) {
    app = app.replace('onAddExpense, onSeparateAccount', 'onAddExpense, onSavingsDetails, onSeparateAccount');
  } else {
    throw new Error('v38 could not find Overview signature anchor.');
  }
}

const savingsHeroAnchor = `          sub={summary.hasSavingsSnapshot ? \`${'${MONTHS[month]} ${year}'}\` : 'No savings snapshot recorded'}\n        />`;
if (!app.includes('onClick={onSavingsDetails}') && app.includes(savingsHeroAnchor)) {
  app = app.replace(
    savingsHeroAnchor,
    `          sub={summary.hasSavingsSnapshot ? \`${'${MONTHS[month]} ${year}'}\` : 'No savings snapshot recorded'}\n          onClick={onSavingsDetails}\n        />`,
  );
}
if (!app.includes('onClick={onSavingsDetails}')) throw new Error('v38 failed to make Savings Snapshot actionable.');

// Savings: use the same clean ledger presentation as Income/Expenses, while retaining explicit edit controls.
app = app.replace(
  '<h2 className="section-title" id="savings-accounts-title">Savings Accounts — {MONTHS[month]} {year}</h2>',
  '<h2 className="section-title" id="savings-accounts-title">Savings</h2>',
);
app = app.replace(
  '<p className="section-note">This snapshot belongs only to the selected month. Historical snapshots are protected when the month is complete.</p>',
  '<p className="section-note">Savings snapshot for {MONTHS[month]} {year}.</p>',
);

if (!app.includes('PENNY_V38_SAVINGS_ROW')) {
  const start = app.indexOf('function SavingsAccountEditor({');
  if (start < 0) throw new Error('v38 could not find SavingsAccountEditor.');
  const nextFunction = app.indexOf('\nfunction ', start + 20);
  if (nextFunction < 0) throw new Error('v38 could not find function boundary after SavingsAccountEditor.');
  const replacement = `function SavingsAccountEditor({ account, canEdit, onCommit, onRemove }) {\n  // PENNY_V38_SAVINGS_ROW\n  const [editing, setEditing] = useState(account.label === 'New savings account');\n  const [label, setLabel] = useState(account.label);\n  const [balance, setBalance] = useState(String(account.balance || ''));\n  useEffect(() => {\n    setLabel(account.label);\n    setBalance(String(account.balance || ''));\n  }, [account.label, account.balance]);\n\n  const save = () => {\n    if (!canEdit) return;\n    const nextLabel = label.trim() || account.label;\n    const nextBalance = Math.max(0, Number(balance) || 0);\n    if (nextLabel !== account.label || nextBalance !== account.balance) {\n      onCommit({ label: nextLabel.slice(0, 80), balance: nextBalance });\n    }\n    setEditing(false);\n  };\n  const cancel = () => {\n    setLabel(account.label);\n    setBalance(String(account.balance || ''));\n    setEditing(false);\n  };\n\n  return (\n    <div className="record-row savings-detail-row">\n      <div className="record-main">\n        {editing ? (\n          <div className="savings-edit-fields">\n            <label className="sr-only" htmlFor={\`saving-label-\${account.id}\`}>Account</label>\n            <input className="savings-edit-input savings-name-input" id={\`saving-label-\${account.id}\`} value={label} onChange={(event) => setLabel(event.target.value)} />\n            <label className="sr-only" htmlFor={\`saving-balance-\${account.id}\`}>Balance</label>\n            <input className="savings-edit-input savings-balance-input" id={\`saving-balance-\${account.id}\`} type="number" inputMode="decimal" min="0" step="0.01" value={balance} placeholder="0.00" onChange={(event) => setBalance(event.target.value)} />\n          </div>\n        ) : (\n          <>\n            <div className="record-title">{account.label}</div>\n            <div className="record-meta">{MONTHS[month]} {year} savings snapshot</div>\n            <div className="pill-line"><span className="status-pill success">Recorded</span></div>\n          </>\n        )}\n      </div>\n      <div className="record-side">\n        {!editing && <div className="money green">{formatMoney(account.balance)}</div>}\n        {canEdit && (\n          <div className="mini-actions savings-actions">\n            {editing ? (\n              <>\n                <button className="secondary-button" onClick={cancel}>Cancel</button>\n                <button className="primary-button" onClick={save}>Save</button>\n              </>\n            ) : (\n              <button className="secondary-button" onClick={() => setEditing(true)}>Edit</button>\n            )}\n            <button className="danger-button" onClick={onRemove}>Delete</button>\n          </div>\n        )}\n      </div>\n    </div>\n  );\n}\n`;
  app = app.slice(0, start) + replacement + app.slice(nextFunction + 1);
}

if (!app.includes('PENNY_V38_SAVINGS_ROW')) throw new Error('v38 savings row replacement failed.');
if (!app.includes("onSavingsDetails={() => setView('Savings')}")) throw new Error('v38 Savings overview navigation missing.');

await writeFile(appPath, app);
console.log('PENNY_V38_SAVINGS_DETAIL applied');
