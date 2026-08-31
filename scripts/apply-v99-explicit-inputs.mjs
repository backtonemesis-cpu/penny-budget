import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

function replaceRequired(before, after, label) {
  if (app.includes(after)) return;
  if (!app.includes(before)) throw new Error('v99 missing anchor: ' + label);
  app = app.replace(before, after);
}

// Savings-goal calculations are kept in one small, testable helper so pennies,
// existing savings and negative balances are handled consistently.
if (!app.includes("from './savings-goal.js'")) {
  replaceRequired(
    "import './styles.css';",
    "import { savingsGoalProgress } from './savings-goal.js'; // PENNY_V99_EXPLICIT_INPUTS\nimport './styles.css';",
    'savings goal helper import',
  );
}

// Blank means the user has not made a choice yet. Labels already explain the
// field, so placeholder choices must not look like saved values.
app = app.replaceAll('<option value="">Select owner</option>', '<option value="" disabled hidden></option>');

replaceRequired(
  'function ReferenceSelect({ id, label, value, options, onChange }) {',
  'function ReferenceSelect({ id, label, value, options, onChange, blankWhenUnassigned = false }) {',
  'ReferenceSelect blank-state prop',
);
replaceRequired(
  `        {options.map((item) => <option key={item.id} value={item.id}>{item.displayLabel || item.label}</option>)}`,
  `        {blankWhenUnassigned && value === 'unassigned' && <option value="unassigned" disabled hidden></option>}\n        {options.filter((item) => !(blankWhenUnassigned && item.id === 'unassigned')).map((item) => <option key={item.id} value={item.id}>{item.displayLabel || item.label}</option>)}`,
  'ReferenceSelect hidden blank option',
);

app = app.replaceAll(
  'label="Received into account" value={account} options={accountOptions}',
  'label="Received into account" value={account} options={accountOptions} blankWhenUnassigned',
);
app = app.replaceAll(
  'label="Paid from account" value={account} options={accountOptions}',
  'label="Paid from account" value={account} options={accountOptions} blankWhenUnassigned',
);

// New income/expense records require deliberate classification/status choices.
replaceRequired(
  `  const [expenseClass, setExpenseClass] = useState(transaction?.expenseClass || presetClass || selectedCategory?.defaultClass || 'variable');`,
  `  const [expenseClass, setExpenseClass] = useState(transaction?.expenseClass || '');`,
  'expense type starts blank',
);
replaceRequired(
  `  const [paid, setPaid] = useState(transaction?.paid ?? false);`,
  `  const [paid, setPaid] = useState(transaction ? Boolean(transaction.paid) : null);`,
  'payment status starts blank',
);
replaceRequired(
  `  const [incomeStatus, setIncomeStatus] = useState(income?.incomeStatus || 'received');`,
  `  const [incomeStatus, setIncomeStatus] = useState(income?.incomeStatus || '');`,
  'income status starts blank',
);
replaceRequired(
  `    setExpenseClass(presetClass || 'variable');`,
  `    setExpenseClass('');`,
  'tab switch expense type reset',
);
replaceRequired(
  `    setPaid(false);`,
  `    setPaid(null);`,
  'tab switch payment status reset',
);
replaceRequired(
  `    setIncomeStatus('received');`,
  `    setIncomeStatus('');`,
  'tab switch income status reset',
);

// Replace the browser-native long category select with a contained, scrollable
// listbox inside Penny. It always starts visually blank and never opens outside
// the modal as a giant system menu.
replaceRequired(
  `  const selectedCategory = categories.find((item) => item.id === category);`,
  `  const selectedCategory = categories.find((item) => item.id === category);\n  const [categoryOpen, setCategoryOpen] = useState(false);`,
  'category picker state',
);
replaceRequired(
  `    setCategory('');`,
  `    setCategory('');\n    setCategoryOpen(false);`,
  'category picker reset',
);

const oldCategoryField = `          <div className="field">\n            <label htmlFor="record-category">Category</label>\n            <select id="record-category" value={category} onChange={(event) => {\n              const next = event.target.value;\n              setCategory(next);\n              const nextCategory = categories.find((item) => item.id === next);\n              if (nextCategory) setExpenseClass(nextCategory.defaultClass || 'variable');\n            }}>\n              <option value="">Select category</option>\n              {categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}</option>)}\n            </select>\n          </div>`;
const newCategoryField = `          <div className="field category-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setCategoryOpen(false); }}>\n            <label id="record-category-label">Category</label>\n            <button\n              id="record-category"\n              type="button"\n              className="category-trigger"\n              aria-labelledby="record-category-label"\n              aria-haspopup="listbox"\n              aria-expanded={categoryOpen}\n              onClick={() => setCategoryOpen((open) => !open)}\n            >\n              <span>{selectedCategory ? selectedCategory.icon + ' ' + selectedCategory.label : ''}</span>\n              <span className="category-chevron" aria-hidden="true">⌄</span>\n            </button>\n            {categoryOpen && (\n              <div className="category-options" role="listbox" aria-labelledby="record-category-label">\n                {categories.map((item) => (\n                  <button\n                    key={item.id}\n                    type="button"\n                    role="option"\n                    aria-selected={category === item.id}\n                    className={category === item.id ? 'category-option selected' : 'category-option'}\n                    onClick={() => { setCategory(item.id); setCategoryOpen(false); if (formError) setFormError(''); }}\n                  >\n                    <span aria-hidden="true">{item.icon}</span>\n                    <span>{item.label}</span>\n                  </button>\n                ))}\n              </div>\n            )}\n          </div>`;
replaceRequired(oldCategoryField, newCategoryField, 'contained category picker');

// Explicit choice validation prevents the normalisers from silently turning a
// blank form into Received / Unpaid / Variable defaults.
replaceRequired(
  `    if (mode === 'income') {\n      const selectedIncomeAccount = (accountOptions || []).find((item) => item.id === account);`,
  `    if (mode === 'income') {\n      if (!['expected', 'received'].includes(incomeStatus)) {\n        setFormError('Choose whether this income is Expected or Received.');\n        return;\n      }\n      const selectedIncomeAccount = (accountOptions || []).find((item) => item.id === account);`,
  'income status required',
);
replaceRequired(
  `    if (type === 'expense' && !category) {\n      setFormError('Select an expense category.');\n      return;\n    }\n    const issues = buildConfirmationIssues(existingIssues, {`,
  `    if (type === 'expense' && !category) {\n      setFormError('Select an expense category.');\n      return;\n    }\n    if (type === 'expense' && !['fixed', 'variable'].includes(expenseClass)) {\n      setFormError('Choose whether this expense is Fixed or Variable.');\n      return;\n    }\n    if (type === 'expense' && typeof paid !== 'boolean') {\n      setFormError('Choose whether this expense is Paid or Unpaid.');\n      return;\n    }\n    const issues = buildConfirmationIssues(existingIssues, {`,
  'expense status choices required',
);

// Blank account fields remain stored as the existing internal TBC/unassigned
// value, but the Add forms do not present "Unassigned" as if it were a choice.
if (!app.includes('blankWhenUnassigned')) throw new Error('v99 blank account selector support missing');

// Date TBC remains valid internal state, but saving a date-less record should
// not leave a persistent banner across unrelated tabs such as Transfers.
replaceRequired(
  `      setMessage(\`Saved with \${confirmationSummary(transaction.confirmationIssues)} still needing confirmation.\`);`,
  `      const visibleIssues = (transaction.confirmationIssues || []).filter((issue) => issue !== 'date');\n      if (visibleIssues.length) setMessage(\`Saved with \${confirmationSummary(visibleIssues)} still needing confirmation.\`);\n      else setMessage('');`,
  'hide transaction date-only save banner',
);
replaceRequired(
  `      setMessage(\`Saved with \${confirmationSummary(income.confirmationIssues)} still needing confirmation.\`);`,
  `      const visibleIssues = (income.confirmationIssues || []).filter((issue) => issue !== 'date');\n      if (visibleIssues.length) setMessage(\`Saved with \${confirmationSummary(visibleIssues)} still needing confirmation.\`);\n      else setMessage('');`,
  'hide income date-only save banner',
);

// Every money entry is direct decimal typing. Browser number spinners are not a
// useful control for bank balances, savings goals or monthly contributions.
replaceRequired(
  `<input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={draft}`,
  `<input id={id} type="text" inputMode="decimal" value={draft}`,
  'plain savings goal and contribution entry',
);
replaceRequired(
  `        type="number"\n        inputMode="decimal"\n        step="0.01"`,
  `        type="text"\n        inputMode="decimal"`,
  'plain transfer current-balance entry',
);
if (/type="number"[^>]*inputMode="decimal"/.test(app)) {
  throw new Error('v99 found a remaining decimal money spinner in App.jsx');
}

// Use explicit penny rounding for the goal calculation. Current savings reduce
// the amount remaining; a negative savings position correctly increases it.
replaceRequired(
  `  const goalRemaining = state.savingsGoal > 0 ? Math.max(state.savingsGoal - summary.currentSavings, 0) : null;\n  const months = goalRemaining && state.savingsContrib > 0 ? Math.ceil(goalRemaining / state.savingsContrib) : null;`,
  `  const goalProgress = savingsGoalProgress(state.savingsGoal, summary.currentSavings, state.savingsContrib);\n  const goalRemaining = state.savingsGoal > 0 ? goalProgress.remaining : null;\n  const months = goalProgress.months;`,
  'precise savings goal calculation',
);

if (!app.includes('PENNY_V98_UI_CLEANUP')) throw new Error('v99 requires v98 base');
if (!app.includes('PENNY_V99_EXPLICIT_INPUTS')) {
  app = app.replace('PENNY_V98_UI_CLEANUP', 'PENNY_V98_UI_CLEANUP PENNY_V99_EXPLICIT_INPUTS');
}
await writeFile(appPath, app);

const stylesPath = 'src/styles.css';
let styles = await readFile(stylesPath, 'utf8');
if (!styles.includes('PENNY_V99_EXPLICIT_INPUTS')) {
  styles += `\n/* PENNY_V99_EXPLICIT_INPUTS */\n.category-picker { position: relative; }\n.category-trigger {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: 100%;\n  min-height: 44px;\n  border: 1px solid var(--border);\n  border-radius: 10px;\n  padding: 9px 11px;\n  background: var(--surface-2);\n  color: var(--text);\n  text-align: left;\n}\n.category-trigger > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.category-chevron { flex: 0 0 auto; color: var(--muted); font-size: 18px; }\n.category-options {\n  display: grid;\n  max-height: 260px;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  border: 1px solid var(--border);\n  border-radius: 10px;\n  padding: 4px;\n  background: var(--surface-2);\n}\n.category-option {\n  display: grid;\n  grid-template-columns: 24px minmax(0, 1fr);\n  align-items: center;\n  min-height: 42px;\n  gap: 8px;\n  border: 0;\n  border-radius: 8px;\n  padding: 8px 10px;\n  background: transparent;\n  color: var(--text);\n  text-align: left;\n}\n.category-option:hover, .category-option:focus-visible, .category-option.selected { background: var(--elevated); }\n.savings-edit-input,\n.funding-balance-editor input {\n  width: 100%;\n  min-height: 44px;\n  border: 1px solid var(--border) !important;\n  border-radius: 10px;\n  padding: 9px 11px;\n  background: var(--surface-2) !important;\n  color: var(--text) !important;\n  -webkit-text-fill-color: var(--text);\n  appearance: none;\n}\n`;
}
await writeFile(stylesPath, styles);

console.log('PENNY_V99 explicit choices, contained category picker and consistent money entry applied');
