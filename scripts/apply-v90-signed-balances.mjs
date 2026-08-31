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

const newFunding = `function FundingBalanceEditor({ row, monthKey, canEdit, onCommit }) {
  const [draft, setDraft] = useState(row.hasCurrentBalance ? String(row.currentBalance) : '');
  const [error, setError] = useState('');
  useEffect(() => {
    setDraft(row.hasCurrentBalance ? String(row.currentBalance) : '');
    setError('');
  }, [row.hasCurrentBalance, row.currentBalance]);
  const editable = canEdit && row.account && row.account !== 'unassigned';
  const commit = () => {
    if (!editable) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('');
      if (row.hasCurrentBalance) onCommit(null);
      return;
    }
    const check = validateMoneyInput(trimmed, { allowZero: true, allowNegative: true });
    if (!check.ok) {
      setError(moneyValidationMessage(check, 'Current bank balance'));
      return;
    }
    setError('');
    if (!row.hasCurrentBalance || check.value !== row.currentBalance) onCommit(check.value);
  };
  return (
    <div className="funding-balance-editor">
      <label htmlFor={\`funding-balance-\${monthKey}-\${row.account}\`}>Current bank balance</label>
      <input
        id={\`funding-balance-\${monthKey}-\${row.account}\`}
        disabled={!editable}
        type="number"
        inputMode="decimal"
        step="0.01"
        value={draft}
        placeholder="0.00"
        aria-invalid={Boolean(error)}
        onChange={(event) => { setDraft(event.target.value); if (error) setError(''); }}
        onBlur={commit}
      />
      {error && <small className="form-error" role="alert">{error}</small>}
      <small>{editable ? 'If left blank, Penny treats the balance as zero. Positive and negative balances are supported.' : 'Assign a bill-paying account before entering a balance.'}</small>
    </div>
  );
}`;

if (!app.includes("validateMoneyInput(trimmed, { allowZero: true, allowNegative: true })")) {
  const fundingStart = app.indexOf('function FundingBalanceEditor(');
  const fundingEnd = app.indexOf('\nfunction SummaryRow(', fundingStart);
  if (fundingStart < 0 || fundingEnd < 0) throw new Error('v90 missing FundingBalanceEditor function boundary');
  app = app.slice(0, fundingStart) + newFunding + app.slice(fundingEnd);
}

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

if ((app.match(/allowNegative: true/g) || []).length < 2) throw new Error('v90 signed balance UI validation missing.');
if (!state.includes('PENNY_V90_SIGNED_BALANCES') || !finance.includes('PENNY_V90_SIGNED_BALANCES')) throw new Error('v90 signed balance persistence patch missing.');
await writeFile('src/App.jsx', app);

console.log('PENNY_V90 signed bank and savings balances applied');
