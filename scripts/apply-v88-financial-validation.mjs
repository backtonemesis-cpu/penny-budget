import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/App.jsx';
let app = await readFile(path, 'utf8');

function replaceRequired(before, after, label) {
  if (app.includes(after)) return;
  if (!app.includes(before)) throw new Error('v88 missing anchor: ' + label);
  app = app.replace(before, after);
}

if (!app.includes("from './money-input.js'")) {
  replaceRequired(
    "import './styles.css';",
    "import { moneyValidationMessage, normaliseComparableLabel, validateMoneyInput } from './money-input.js'; // PENNY_V88_FINANCIAL_VALIDATION\nimport './styles.css';",
    'money validation import',
  );
}

// Validate the decimal string before converting it to Number so values that
// cannot retain exact penny precision are rejected instead of silently changed.
replaceRequired(
  `    const hasPositiveAmount = Number(amount) > 0;\n    if (!hasPositiveAmount && !(mode === 'income' && incomeStatus === 'expected')) {\n      setFormError('Enter an amount greater than zero.');\n      return;\n    }`,
  `    const amountProvided = String(amount ?? '').trim() !== '';\n    const amountCheck = amountProvided ? validateMoneyInput(amount) : { ok: false, code: 'required' };\n    if (amountProvided && !amountCheck.ok) {\n      setFormError(moneyValidationMessage(amountCheck, 'Amount'));\n      return;\n    }\n    const hasPositiveAmount = Boolean(amountCheck.ok);\n    if (!hasPositiveAmount && !(mode === 'income' && incomeStatus === 'expected')) {\n      setFormError(moneyValidationMessage(amountCheck, 'Amount'));\n      return;\n    }`,
  'record amount validation',
);
replaceRequired(
  '          amount: amountConfirmed ? amount : 0,',
  '          amount: amountConfirmed ? amountCheck.value : 0,',
  'income safe amount value',
);
replaceRequired(
  '        amount,\n        desc: description,',
  '        amount: amountCheck.value,\n        desc: description,',
  'expense safe amount value',
);

// Preserve any duplicate categories already in historical data, but stop users
// from creating another indistinguishable name (case/whitespace insensitive).
replaceRequired(
  `function CategoryManager({ categories, state, mutate }) {\n  const [name, setName] = useState('');\n  const [icon, setIcon] = useState('🏷️');\n  const [defaultClass, setDefaultClass] = useState('variable');\n  const add = () => {\n    const label = name.trim();\n    if (!label) return;`,
  `function CategoryManager({ categories, state, mutate }) {\n  const [name, setName] = useState('');\n  const [icon, setIcon] = useState('🏷️');\n  const [defaultClass, setDefaultClass] = useState('variable');\n  const [error, setError] = useState('');\n  const add = () => {\n    const label = name.trim().replace(/\\s+/g, ' ');\n    if (!label) return;\n    const duplicate = categories.find((category) => normaliseComparableLabel(category.label) === normaliseComparableLabel(label));\n    if (duplicate) {\n      setError('A category named “' + duplicate.label + '” already exists. Choose a different name.');\n      return;\n    }\n    setError('');`,
  'category duplicate guard',
);
replaceRequired(
  `    setName('');\n    setIcon('🏷️');\n    setDefaultClass('variable');`,
  `    setName('');\n    setIcon('🏷️');\n    setDefaultClass('variable');\n    setError('');`,
  'category error reset',
);
replaceRequired(
  `        <input id="category-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="For example: Childcare" />\n      </div>`,
  `        <input id="category-name" value={name} onChange={(event) => { setName(event.target.value); if (error) setError(''); }} placeholder="For example: Childcare" />\n        {error && <small className="form-error" role="alert">{error}</small>}\n      </div>`,
  'category duplicate feedback',
);

// Final v40/v44 savings editor: reject invalid/negative/unsafe balance inputs,
// leave the editor open, and show the precise field error.
replaceRequired(
  `  const [editing, setEditing] = useState(false);\n  const [balance, setBalance] = useState(String(account.balance || ''));\n  useEffect(() => setBalance(String(account.balance || '')), [account.balance]);`,
  `  const [editing, setEditing] = useState(false);\n  const [balance, setBalance] = useState(String(account.balance || ''));\n  const [balanceError, setBalanceError] = useState('');\n  useEffect(() => setBalance(String(account.balance || '')), [account.balance]);`,
  'savings balance error state',
);
replaceRequired(
  `  const save = () => {\n    if (!canEdit) return;\n    const nextBalance = Math.max(0, Number(balance) || 0);\n    if (nextBalance !== account.balance) onCommit({ balance: nextBalance });\n    setEditing(false);\n  };`,
  `  const save = () => {\n    if (!canEdit) return;\n    const balanceText = String(balance ?? '').trim();\n    const balanceCheck = balanceText ? validateMoneyInput(balanceText, { allowZero: true }) : { ok: true, value: 0 };\n    if (!balanceCheck.ok) {\n      setBalanceError(moneyValidationMessage(balanceCheck, 'Balance'));\n      return;\n    }\n    setBalanceError('');\n    const nextBalance = balanceCheck.value;\n    if (nextBalance !== account.balance) onCommit({ balance: nextBalance });\n    setEditing(false);\n  };`,
  'savings balance validation',
);
replaceRequired(
  `            <input id={\`saving-balance-\${account.id}\`} type="number" inputMode="decimal" min="0" step="0.01" value={balance} placeholder="0.00" onChange={(event) => setBalance(event.target.value)} />`,
  `            <input id={\`saving-balance-\${account.id}\`} type="number" inputMode="decimal" min="0" step="0.01" value={balance} placeholder="0.00" aria-invalid={Boolean(balanceError)} onChange={(event) => { setBalance(event.target.value); if (balanceError) setBalanceError(''); }} />\n            {balanceError && <small className="form-error" role="alert">{balanceError}</small>}`,
  'savings balance feedback',
);
replaceRequired(
  `<button className="secondary-button" onClick={() => { setBalance(String(account.balance || '')); setEditing(false); }}>Cancel</button>`,
  `<button className="secondary-button" onClick={() => { setBalance(String(account.balance || '')); setBalanceError(''); setEditing(false); }}>Cancel</button>`,
  'savings balance cancel reset',
);

// Savings goal and monthly contribution use the same exact-money validator.
replaceRequired(
  `function NumberField({ label, value, onCommit }) {\n  const id = \`field-\${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}\`;\n  const [draft, setDraft] = useState(String(value || ''));\n  useEffect(() => setDraft(String(value || '')), [value]);\n  const commit = () => {\n    const next = Math.max(0, Number(draft) || 0);\n    if (next !== value) onCommit(next);\n  };\n  return (\n    <div className="field">\n      <label htmlFor={id}>{label}</label>\n      <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={draft} placeholder="0.00" onChange={(event) => setDraft(event.target.value)} onBlur={commit} />\n    </div>\n  );\n}`,
  `function NumberField({ label, value, onCommit }) {\n  const id = \`field-\${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}\`;\n  const [draft, setDraft] = useState(String(value || ''));\n  const [error, setError] = useState('');\n  useEffect(() => setDraft(String(value || '')), [value]);\n  const commit = () => {\n    const text = String(draft ?? '').trim();\n    const check = text ? validateMoneyInput(text, { allowZero: true }) : { ok: true, value: 0 };\n    if (!check.ok) {\n      setError(moneyValidationMessage(check, label));\n      return;\n    }\n    setError('');\n    if (check.value !== value) onCommit(check.value);\n  };\n  return (\n    <div className="field">\n      <label htmlFor={id}>{label}</label>\n      <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={draft} placeholder="0.00" aria-invalid={Boolean(error)} onChange={(event) => { setDraft(event.target.value); if (error) setError(''); }} onBlur={commit} />\n      {error && <small className="form-error" role="alert">{error}</small>}\n    </div>\n  );\n}`,
  'savings goal validation',
);

// Explain the month-setup savings switch precisely. With the snapshot off,
// neither balances nor the selected month's savings-account definitions copy.
replaceRequired(
  `      <p className="section-note">Carry forward planning records from {sourceLabel}. Bills start Unpaid. Regular income starts Expected. Child Benefit and Child Maintenance keep the previous amount; pay and variable benefits carry forward with Amount TBC until confirmed. Actual day-to-day spending, transfers and bank balances are never copied.</p>`,
  `      <p className="section-note">Carry forward planning records from {sourceLabel}. Bills start Unpaid. Regular income starts Expected. Child Benefit and Child Maintenance keep the previous amount; pay and variable benefits carry forward with Amount TBC until confirmed. Actual day-to-day spending, transfers and bank balances are never copied. Savings snapshot is separate: if you switch it off, Penny does not copy the savings account definitions or their balances, so Savings for the new month starts empty.</p>`,
  'month setup savings explanation',
);
replaceRequired(
  `        {canEdit && !displayedSavingsAccounts.length && <div className="empty savings-settings-hint">Add savings accounts in Settings first.</div>}`,
  `        {canEdit && !displayedSavingsAccounts.length && <div className="empty savings-settings-hint">No savings accounts are set up for this month. If Savings snapshot was off during month setup, account definitions were intentionally not copied. Add them in Settings.</div>}`,
  'savings empty-state explanation',
);

if (!app.includes('PENNY_V88_FINANCIAL_VALIDATION')) throw new Error('v88 money validation import missing.');
if (!app.includes("moneyValidationMessage(amountCheck, 'Amount')")) throw new Error('v88 record amount validation missing.');
if (!app.includes('A category named “')) throw new Error('v88 duplicate category feedback missing.');
if (!app.includes("moneyValidationMessage(balanceCheck, 'Balance')")) throw new Error('v88 savings balance validation missing.');
if (!app.includes('Savings snapshot is separate: if you switch it off')) throw new Error('v88 month setup explanation missing.');

await writeFile(path, app);
console.log('PENNY_V88 financial validation fixes applied');
