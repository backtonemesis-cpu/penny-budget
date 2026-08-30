import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

const propAnchor = "            onAddExpense={() => openRecord({ mode: 'expense' })}";
const propReplacement = "            onExpenseDetails={() => setView('Transactions')} // PENNY_V32_EXPENSE_DETAIL";
if (!app.includes(propAnchor) && !app.includes(propReplacement)) {
  throw new Error('v32 could not find the Overview expense action prop.');
}
app = app.replace(propAnchor, propReplacement);

const signatureAnchor = 'onIncomeDetails, onAddExpense, onSeparateAccount';
const signatureReplacement = 'onIncomeDetails, onExpenseDetails, onSeparateAccount';
if (!app.includes(signatureAnchor) && !app.includes(signatureReplacement)) {
  throw new Error('v32 could not find the Overview expense action signature.');
}
app = app.replace(signatureAnchor, signatureReplacement);

const expenseStatAnchor = '<Stat variant="compact" label="Expenses" value={formatMoney(summary.expenses)} tone="amber" sub="This month" onClick={canEditMonth ? onAddExpense : undefined} />';
const expenseStatReplacement = '<Stat variant="compact" label="Expenses" value={formatMoney(summary.expenses)} tone="amber" sub="This month" onClick={onExpenseDetails} />';
if (!app.includes(expenseStatAnchor) && !app.includes(expenseStatReplacement)) {
  throw new Error('v32 could not find the Overview Expenses card.');
}
app = app.replace(expenseStatAnchor, expenseStatReplacement);

if (!app.includes("onExpenseDetails={() => setView('Transactions')}")) {
  throw new Error('v32 failed to wire the Expenses card to Transactions.');
}
if (!app.includes('onClick={onExpenseDetails}')) {
  throw new Error('v32 failed to make the Expenses card open expense detail.');
}
if (!app.includes("const [tab, setTab] = useState('expenses');")) {
  throw new Error('v32 requires Transactions to open on the Expenses tab.');
}

await writeFile(appPath, app);
console.log('PENNY_V32_EXPENSE_DETAIL applied');
