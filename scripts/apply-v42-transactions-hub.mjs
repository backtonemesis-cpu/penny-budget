import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/App.jsx';
let app = await readFile(path, 'utf8');

function once(search, replacement, label) {
  const index = app.indexOf(search);
  if (index < 0) {
    if (app.includes(replacement)) return;
    throw new Error(`v42 missing anchor: ${label}`);
  }
  app = app.slice(0, index) + replacement + app.slice(index + search.length);
}

if (!app.includes('PENNY_V42_TRANSACTIONS_HUB')) {
  once(
    "  const [view, setView] = useState('Overview');",
    "  const [view, setView] = useState('Overview');\n  const [transactionTab, setTransactionTab] = useState('income'); // PENNY_V42_TRANSACTIONS_HUB",
    'transaction tab state',
  );

  app = app.replace(
    /onIncomeDetails=\{\(\) => setView\('Income'\)\}/g,
    "onIncomeDetails={() => { setTransactionTab('income'); setView('Transactions'); }}",
  );
  app = app.replace(
    /onExpenseDetails=\{\(\) => setView\('Expenses'\)\}(?: \/\/[^\n]*)?/g,
    "onExpenseDetails={() => { setTransactionTab('expenses'); setView('Transactions'); }} // PENNY_V42_EXPENSE_ROUTE",
  );
  app = app.replace(
    /onSavingsDetails=\{\(\) => setView\('Savings'\)\}/g,
    "onSavingsDetails={() => { setTransactionTab('savings'); setView('Transactions'); }}",
  );

  const txInvocation = "          <Transactions\n            summary={summary}";
  once(
    txInvocation,
    "          <Transactions\n            selectedTab={transactionTab}\n            onTabChange={setTransactionTab}\n            state={state}\n            monthKey={monthKey}\n            month={period.month}\n            year={period.year}\n            mutate={mutate}\n            summary={summary}",
    'Transactions invocation',
  );

  once(
    'function Transactions({ summary, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onToggleIncomeReceived, onDeleteTransaction, onDeleteIncome }) {',
    'function Transactions({ selectedTab, onTabChange, state, monthKey, month, year, mutate, summary, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onToggleIncomeReceived, onDeleteTransaction, onDeleteIncome }) {',
    'Transactions signature',
  );
  once(
    "  const [tab, setTab] = useState('expenses');",
    "  const tab = selectedTab;\n  const setTab = onTabChange;",
    'controlled transaction tab',
  );

  const tabsStart = app.indexOf('      <div className="tabs" role="tablist" aria-label="Transactions sections">');
  const tabsEnd = app.indexOf('      </div>', tabsStart);
  if (tabsStart < 0 || tabsEnd < 0) throw new Error('v42 could not locate Transactions tabs');
  const newTabs = `      <div className="tabs money-flow-tabs" role="tablist" aria-label="Monthly money sections">\n        <button role="tab" aria-selected={tab === 'income'} className={tab === 'income' ? 'active' : ''} onClick={() => setTab('income')}>Income</button>\n        <button role="tab" aria-selected={tab === 'expenses'} className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>Expenses</button>\n        <button role="tab" aria-selected={tab === 'savings'} className={tab === 'savings' ? 'active' : ''} onClick={() => setTab('savings')}>Savings</button>\n      </div>`;
  app = app.slice(0, tabsStart) + newTabs + app.slice(tabsEnd + '      </div>'.length);

  const filterStart = app.indexOf('      <section className="card filter-card" aria-label="Transaction filters">');
  if (filterStart < 0) throw new Error('v42 could not locate transaction filter card');
  const filterEnd = app.indexOf('      </section>', filterStart);
  if (filterEnd < 0) throw new Error('v42 could not locate transaction filter card end');
  const filterBlock = app.slice(filterStart, filterEnd + '      </section>'.length);
  app = app.slice(0, filterStart) + `      {tab !== 'savings' && (\n${filterBlock}\n      )}` + app.slice(filterEnd + '      </section>'.length);

  const movementStart = app.indexOf("      {tab === 'movements' && (");
  const componentEndMarker = '    </>\n  );\n}\n\nfunction ExpenseRow';
  const componentEnd = app.indexOf(componentEndMarker, movementStart);
  if (movementStart < 0 || componentEnd < 0) throw new Error('v42 could not locate legacy movements block');

  const savingsAndAudit = `      {tab === 'savings' && (\n        <Savings\n          state={state}\n          summary={summary}\n          monthKey={monthKey}\n          month={month}\n          year={year}\n          canEdit={canEdit}\n          mutate={mutate}\n        />\n      )}\n\n      <details className="card disclosure-card audit-movements">\n        <summary>Transfers & excluded movements</summary>\n        <div className="disclosure-body">\n          <p className="section-note">Internal transfers, savings transfers and card repayments remain visible for audit but do not count as expenses or income.</p>\n          {movements.length ? movements.map((transaction) => (\n            <div className="record-row" key={transaction.id}>\n              <div className="record-main">\n                <div className="record-title">{transaction.desc}</div>\n                <div className="record-meta">{recordDateLabel(transaction)} · {SPECIAL_TRANSACTION_META[transaction.type]?.label || 'Legacy credit'}</div>\n                <RecordBadges record={transaction} />\n              </div>\n              <div className="record-side">\n                <div className="money">{formatMoney(transaction.amount)}</div>\n                {canEdit && <div className="mini-actions">\n                  {transaction.type !== 'refund' && <button className="secondary-button" onClick={() => onEditTransaction(transaction)}>Edit</button>}\n                  <button className="danger-button" onClick={() => onDeleteTransaction(transaction)}>Delete</button>\n                </div>}\n              </div>\n            </div>\n          )) : <div className="empty">No transfers or excluded movements recorded.</div>}\n        </div>\n      </details>\n`;
  app = app.slice(0, movementStart) + savingsAndAudit + app.slice(componentEnd);

  app = app.replace("{['Overview', 'Transactions', 'Savings', 'Year'].map((item) => (", "{['Overview', 'Transactions', 'Year'].map((item) => (");
  app = app.replace(
    '            onClick={() => setView(item)}',
    "            onClick={() => { if (item === 'Transactions') setTransactionTab('income'); setView(item); }}",
  );
}

if (!app.includes("setTransactionTab('income'); setView('Transactions')")) throw new Error('v42 Income overview route missing');
if (!app.includes("setTransactionTab('expenses'); setView('Transactions')")) throw new Error('v42 Expenses overview route missing');
if (!app.includes("setTransactionTab('savings'); setView('Transactions')")) throw new Error('v42 Savings overview route missing');
if (!app.includes(">Income</button>") || !app.includes(">Expenses</button>") || !app.includes(">Savings</button>")) throw new Error('v42 money-flow tabs missing');
if (app.includes("{['Overview', 'Transactions', 'Savings', 'Year'].map")) throw new Error('v42 separate Savings primary nav still present');
if (!app.includes('Transfers & excluded movements')) throw new Error('v42 audit movements disclosure missing');

await writeFile(path, app);
console.log('PENNY_V42_TRANSACTIONS_HUB applied');
