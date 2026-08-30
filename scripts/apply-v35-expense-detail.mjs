import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

app = app.replace(
  "            onExpenseDetails={() => { setView('Transactions'); globalThis.__PENNY_OPEN_EXPENSES__ = true; }} // PENNY_V32_EXPENSE_NAV",
  "            onExpenseDetails={() => setView('Expenses')} // PENNY_V35_EXPENSE_DETAIL",
);

if (!app.includes("{view === 'Expenses' && (")) {
  app = app.replace(
    "        {view === 'Income' && (",
    `        {view === 'Expenses' && (\n          <ExpenseDetail\n            summary={summary}\n            month={period.month}\n            year={period.year}\n            categoryMap={categoryMap}\n            peopleMap={peopleMap}\n            accountMap={accountMap}\n            canEdit={canEditMonth}\n            onBack={() => setView('Overview')}\n            onAdd={() => openRecord({ mode: 'expense' })}\n            onEdit={(transaction) => openRecord({ mode: 'expense', transaction })}\n            onTogglePaid={togglePaid}\n            onDelete={deleteTransaction}\n          />\n        )}\n\n        {view === 'Income' && (`,
  );
}

if (!app.includes('function ExpenseDetail({')) {
  const expenseDetail = `\nfunction ExpenseDetail({ summary, month, year, categoryMap, peopleMap, accountMap, canEdit, onBack, onAdd, onEdit, onTogglePaid, onDelete }) {\n  const records = summary.expenseTransactions || [];\n  return (\n    <>\n      <section className=\"card income-detail-card expense-detail-card\" aria-labelledby=\"expense-detail-title\">\n        <div className=\"section-heading income-detail-heading\">\n          <div>\n            <h2 className=\"section-title\" id=\"expense-detail-title\">Expense Detail — {MONTHS[month]} {year}</h2>\n            <p className=\"section-note\">Every expense recorded for this month, including who paid it and which account was used.</p>\n          </div>\n          <div className=\"mini-actions\">\n            <button className=\"secondary-button\" onClick={onBack}>Back to Overview</button>\n            {canEdit && <button className=\"primary-button\" onClick={onAdd}>+ Add Expense</button>}\n          </div>\n        </div>\n        {records.length ? records.map((transaction) => (\n          <div className=\"record-row income-detail-row expense-detail-row\" key={transaction.id}>\n            <div className=\"record-main\">\n              <div className=\"record-title\">{transaction.desc}</div>\n              <div className=\"record-meta\">Category: {categoryMap[transaction.category]?.label || transaction.category}</div>\n              <div className=\"record-meta\">Date: {transaction.dateConfirmed === false ? 'Exact date TBC' : formatDate(transaction.date)}</div>\n              <div className=\"record-meta\">Paid by: {transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || transaction.paidBy || 'TBC'}</div>\n              <div className=\"record-meta\">Account: {ownedRecordAccountLabel(transaction, accountMap, peopleMap)}</div>\n              <div className=\"pill-line\"><span className={\`status-pill \${transaction.paid ? 'success' : 'warning'}\`}>{transaction.paid ? 'Paid' : 'Unpaid'}</span><span className=\"status-pill neutral\">{transaction.expenseClass === 'fixed' ? 'Fixed' : 'Variable'}</span><RecordBadges record={transaction} compact /></div>\n            </div>\n            <div className=\"record-side\">\n              <div className=\"money amber\">{formatMoney(transaction.amount)}</div>\n              {canEdit && <div className=\"mini-actions\">\n                <button className=\"secondary-button\" onClick={() => onTogglePaid(transaction)}>{transaction.paid ? 'Mark unpaid' : 'Mark paid'}</button>\n                <button className=\"secondary-button\" onClick={() => onEdit(transaction)}>Edit</button>\n                <button className=\"danger-button\" onClick={() => onDelete(transaction)}>Delete</button>\n              </div>}\n            </div>\n          </div>\n        )) : <div className=\"empty\">No expenses have been recorded for this month.</div>}\n        <div className=\"total-line\"><span>Recorded expense total</span><span className=\"money amber\">{formatMoney(summary.expenses)}</span></div>\n      </section>\n    </>\n  );\n}\n\n`;
  app = app.replace('function IncomeDetail({', `${expenseDetail}function IncomeDetail({`);
}

await writeFile(appPath, app);
console.log('PENNY_V35_EXPENSE_DETAIL applied');
