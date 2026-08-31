import { readFile, writeFile } from 'node:fs/promises';

function replaceRequired(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error('v90 missing anchor: ' + label);
  return text.replace(before, after);
}

// Balance fields represent real account positions and may legitimately be negative.
// Goals, contributions, income and expense amounts remain non-negative.
let state = await readFile('src/state.js', 'utf8');
state = replaceRequired(
  state,
  "  positiveNumber,\n} from './finance.js';",
  "  positiveNumber,\n  signedNumber,\n} from './finance.js';",
  'state signedNumber import',
);
const stateBalanceCount = (state.match(/balance: positiveNumber\(item\?\.balance\)/g) || []).length;
if (stateBalanceCount !== 2 && !state.includes('PENNY_V90_SIGNED_BALANCES')) {
  throw new Error('v90 expected exactly two reducer balance normalisers, found ' + stateBalanceCount);
}
if (!state.includes('PENNY_V90_SIGNED_BALANCES')) {
  state = state.replaceAll('balance: positiveNumber(item?.balance)', 'balance: signedNumber(item?.balance)');
  state = state.replace("import { recurringBillKey, recurringIncomeKey } from './month-setup.js';", "import { recurringBillKey, recurringIncomeKey } from './month-setup.js';\n// PENNY_V90_SIGNED_BALANCES");
}
await writeFile('src/state.js', state);

let finance = await readFile('src/finance.js', 'utf8');
const financeBalanceCount = (finance.match(/balance: nonNegativeNumber\(item\?\.balance\)/g) || []).length;
if (financeBalanceCount !== 2 && !finance.includes('PENNY_V90_SIGNED_BALANCES')) {
  throw new Error('v90 expected exactly two persisted balance normalisers, found ' + financeBalanceCount);
}
if (!finance.includes('PENNY_V90_SIGNED_BALANCES')) {
  finance = finance.replaceAll('balance: nonNegativeNumber(item?.balance)', 'balance: signedNumber(item?.balance)');
  finance = finance.replace("const SPECIAL_ACCOUNT_MAP = Object.fromEntries(SPECIAL_ACCOUNTS.map((item) => [item.id, item.label]));", "const SPECIAL_ACCOUNT_MAP = Object.fromEntries(SPECIAL_ACCOUNTS.map((item) => [item.id, item.label]));\n// PENNY_V90_SIGNED_BALANCES");
}
await writeFile('src/finance.js', finance);

let app = await readFile('src/App.jsx', 'utf8');

const oldFunding = `function FundingBalanceEditor({ row, monthKey, canEdit, onCommit }) {\n  const [draft, setDraft] = useState(row.hasCurrentBalance ? String(row.currentBalance) : '');\n  useEffect(() => setDraft(row.hasCurrentBalance ? String(row.currentBalance) : ''), [row.hasCurrentBalance, row.currentBalance]);\n  const editable = canEdit && row.account && row.account !== 'unassigned';\n  const commit = () => {\n    if (!editable) return;\n    const trimmed = draft.trim();\n    if (!trimmed) {\n      if (row.hasCurrentBalance) onCommit(null);\n      return;\n    }\n    const parsed = Number(trimmed);\n    if (!Number.isFinite(parsed) || parsed < 0) {\n      setDraft(row.hasCurrentBalance ? String(row.currentBalance) : '');\n      return;\n    }\n    if (!row.hasCurrentBalance || parsed !== row.currentBalance) onCommit(parsed);\n  };\n  return (\n    <div className=\"funding-balance-editor\">\n      <label htmlFor={\`funding-balance-\${monthKey}-\${row.account}\`}>Current bank balance</label>\n      <input\n        id={\`funding-balance-\${monthKey}-\${row.account}\`}\n        disabled={!editable}\n        type=\"number\"\n        inputMode=\"decimal\"\n        min=\"0\"\n        step=\"0.01\"\n        value={draft}\n        placeholder=\"TBC\"\n        onChange={(event) => setDraft(event.target.value)}\n        onBlur={commit}\n      />\n      <small>{editable ? 'Clear the field to return this balance to TBC.' : 'Assign a bill-paying account before entering a balance.'}</small>\n    </div>\n  );\n}`;

const newFunding = `function FundingBalanceEditor({ row, monthKey, canEdit, onCommit }) {\n  const [draft, setDraft] = useState(row.hasCurrentBalance ? String(row.currentBalance) : '');\n  const [error, setError] = useState('');\n  useEffect(() => {\n    setDraft(row.hasCurrentBalance ? String(row.currentBalance) : '');\n    setError('');\n  }, [row.hasCurrentBalance, row.currentBalance]);\n  const editable = canEdit && row.account && row.account !== 'unassigned';\n  const commit = () => {\n    if (!editable) return;\n    const trimmed = draft.trim();\n    if (!trimmed) {\n      setError('');\n      if (row.hasCurrentBalance) onCommit(null);\n      return;\n    }\n    const check = validateMoneyInput(trimmed, { allowZero: true, allowNegative: true });\n    if (!check.ok) {\n      setError(moneyValidationMessage(check, 'Current bank balance'));\n      return;\n    }\n    setError('');\n    if (!row.hasCurrentBalance || check.value !== row.currentBalance) onCommit(check.value);\n  };\n  return (\n    <div className=\"funding-balance-editor\">\n      <label htmlFor={\`funding-balance-\${monthKey}-\${row.account}\`}>Current bank balance</label>\n      <input\n        id={\`funding-balance-\${monthKey}-\${row.account}\`}\n        disabled={!editable}\n        type=\"number\"\n        inputMode=\"decimal\"\n        step=\"0.01\"\n        value={draft}\n        placeholder=\"TBC\"\n        aria-invalid={Boolean(error)}\n        onChange={(event) => { setDraft(event.target.value); if (error) setError(''); }}\n        onBlur={commit}\n      />\n      {error && <small className=\"form-error\" role=\"alert\">{error}</small>}\n      <small>{editable ? 'Positive and negative balances are supported. Clear the field to return this balance to TBC.' : 'Assign a bill-paying account before entering a balance.'}</small>\n    </div>\n  );\n}`;
app = replaceRequired(app, oldFunding, newFunding, 'Transfer Plan signed bank balance editor');

app = replaceRequired(
  app,
  "const balanceCheck = balanceText ? validateMoneyInput(balanceText, { allowZero: true }) : { ok: true, value: 0 };",
  "const balanceCheck = balanceText ? validateMoneyInput(balanceText, { allowZero: true, allowNegative: true }) : { ok: true, value: 0 };",
  'Savings signed balance validation',
);
app = replaceRequired(
  app,
  'type="number" inputMode="decimal" min="0" step="0.01" value={balance} placeholder="0.00" aria-invalid={Boolean(balanceError)}',
  'type="number" inputMode="decimal" step="0.01" value={balance} placeholder="0.00" aria-invalid={Boolean(balanceError)}',
  'Savings signed balance input',
);

if (!app.includes('allowNegative: true')) throw new Error('v90 signed balance UI validation missing.');
if (!state.includes('PENNY_V90_SIGNED_BALANCES') || !finance.includes('PENNY_V90_SIGNED_BALANCES')) throw new Error('v90 signed balance persistence patch missing.');
await writeFile('src/App.jsx', app);

console.log('PENNY_V90 signed bank and savings balances applied');
