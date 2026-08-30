import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

const dedicatedExpenseRoute = "            onExpenseDetails={() => setView('Expenses')} // PENNY_V35_EXPENSE_DETAIL";
const legacyExpenseRoutes = [
  "            onExpenseDetails={() => setView('Transactions')} // PENNY_V32_EXPENSE_DETAIL",
  "            onExpenseDetails={() => setView('Transactions')} // PENNY_V32_EXPENSE_NAV",
  "            onExpenseDetails={() => { setView('Transactions'); globalThis.__PENNY_OPEN_EXPENSES__ = true; }} // PENNY_V32_EXPENSE_NAV",
  "            onExpenseDetails={() => { setView('Transactions'); globalThis.__PENNY_OPEN_EXPENSES__ = true; }} // PENNY_V32_EXPENSE_DETAIL",
];

if (!app.includes(dedicatedExpenseRoute)) {
  const legacyRoute = legacyExpenseRoutes.find((candidate) => app.includes(candidate));
  if (!legacyRoute) throw new Error('v35 could not find the Overview Expenses navigation route. Refusing to build with ambiguous Expenses navigation.');
  app = app.replace(legacyRoute, dedicatedExpenseRoute);
}

if (!app.includes("{view === 'Expenses' && (")) {
  const incomeViewAnchor = "        {view === 'Income' && (";
  if (!app.includes(incomeViewAnchor)) throw new Error('v35 could not find the Income detail view anchor needed to install Expense Detail.');
  app = app.replace(incomeViewAnchor, `        {view === 'Expenses' && (\n          <ExpenseDetail\n            summary={summary}\n            month={period.month}\n            year={period.year}\n            categoryMap={categoryMap}\n            peopleMap={peopleMap}\n            accountMap={accountMap}\n            canEdit={canEditMonth}\n            onBack={() => setView('Overview')}\n            onAdd={() => openRecord({ mode: 'expense' })}\n            onEdit={(transaction) => openRecord({ mode: 'expense', transaction })}\n            onTogglePaid={togglePaid}\n            onDelete={deleteTransaction}\n          />\n        )}\n\n        {view === 'Income' && (`);
}

if (!app.includes('function ExpenseDetail({')) {
  const expenseDetail = `\nfunction ExpenseDetail({ summary, month, year, categoryMap, peopleMap, accountMap, canEdit, onBack, onAdd, onEdit, onTogglePaid, onDelete }) {\n  const records = summary.expenseTransactions || [];\n  return (\n    <>\n      <section className=\"card income-detail-card expense-detail-card\" aria-labelledby=\"expense-detail-title\">\n        <div className=\"section-heading income-detail-heading\">\n          <div>\n            <h2 className=\"section-title\" id=\"expense-detail-title\">Expense Detail — {MONTHS[month]} {year}</h2>\n            <p className=\"section-note\">Every expense recorded for this month, including who paid it and which account was used.</p>\n          </div>\n          <div className=\"mini-actions\">\n            <button className=\"secondary-button\" onClick={onBack}>Back to Overview</button>\n            {canEdit && <button className=\"primary-button\" onClick={onAdd}>+ Add Expense</button>}\n          </div>\n        </div>\n        {records.length ? records.map((transaction) => {\n          const categoryLabel = categoryMap[transaction.category]?.label || transaction.category || 'TBC';\n          const expenseType = transaction.expenseClass === 'fixed' ? 'Fixed' : 'Variable';\n          const paidBy = transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || transaction.paidBy || 'TBC';\n          const accountLabel = ownedRecordAccountLabel(transaction, accountMap, peopleMap);\n          return (\n          <div className=\"record-row income-detail-row expense-detail-row\" key={transaction.id}>\n            <div className=\"record-main\">\n              <div className=\"record-title\">{transaction.desc}</div>\n              <div className=\"record-meta\">{transaction.dateConfirmed === false ? 'Date TBC' : formatDate(transaction.date)}</div>\n              <div className=\"record-meta\">{expenseType} · {categoryLabel}</div>\n              <div className=\"record-meta\">{paidBy} · {accountLabel}</div>\n              <div className=\"pill-line\"><span className={\`status-pill \${transaction.paid ? 'success' : 'warning'}\`}>{transaction.paid ? 'Paid' : 'Unpaid'}</span><RecordBadges record={transaction} compact /></div>\n            </div>\n            <div className=\"record-side\">\n              <div className=\"money amber\">{formatMoney(transaction.amount)}</div>\n              {canEdit && <div className=\"mini-actions\">\n                <button className=\"secondary-button\" onClick={() => onTogglePaid(transaction)}>{transaction.paid ? 'Mark unpaid' : 'Mark paid'}</button>\n                <button className=\"secondary-button\" onClick={() => onEdit(transaction)}>Edit</button>\n                <button className=\"danger-button\" onClick={() => onDelete(transaction)}>Delete</button>\n              </div>}\n            </div>\n          </div>\n          );\n        }) : <div className=\"empty\">No expenses have been recorded for this month.</div>}\n        <div className=\"total-line\"><span>Recorded expense total</span><span className=\"money amber\">{formatMoney(summary.expenses)}</span></div>\n      </section>\n    </>\n  );\n}\n\n`;
  const incomeDetailAnchor = 'function IncomeDetail({';
  if (!app.includes(incomeDetailAnchor)) throw new Error('v35 could not find IncomeDetail to install the matching ExpenseDetail component.');
  app = app.replace(incomeDetailAnchor, `${expenseDetail}${incomeDetailAnchor}`);
}

if (!app.includes(dedicatedExpenseRoute)) throw new Error('v35 failed: Overview Expenses is not routed to the dedicated Expense Detail view.');
if (legacyExpenseRoutes.some((candidate) => app.includes(candidate))) throw new Error('v35 failed: a legacy Overview Expenses -> Transactions route still exists.');
if (!app.includes("{view === 'Expenses' && (") || !app.includes('function ExpenseDetail({')) throw new Error('v35 failed: dedicated Expense Detail view/component is incomplete.');

await writeFile(appPath, app);
console.log('PENNY_V35_EXPENSE_DETAIL applied with verified dedicated routing and three-line expense metadata');
