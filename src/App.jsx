import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  BASE_CATEGORIES,
  MOVEMENT_TYPES,
  SPECIAL_ACCOUNTS,
  SPECIAL_PEOPLE,
  SPECIAL_TRANSACTION_META,
  makeCategoryMap,
  makeReferenceMap,
} from './catalog.js';
import { currentLocalPeriod, currentPeriodCheckDelay } from './current-period.js';
import {
  MONTHS,
  SHORT_MONTHS,
  annualSummary,
  createId,
  formatDate,
  formatMoney,
  isValidMonthKey,
  localDateKey,
  mkKey,
  monthSummary,
  normaliseIncomeRecord,
  normaliseTransaction,
} from './finance.js';
import { appReducer, categoryInUse, referenceInUse } from './state.js';
import {
  clearPennyState,
  createBackupText,
  getBrowserStorage,
  loadState,
  mergeImportedMonths,
  parseBackupPackage,
  saveState,
} from './storage.js';
import './styles.css';

const browserStorage = getBrowserStorage();
const initialLoad = loadState(browserStorage, new Date());
const initialPeriod = currentLocalPeriod();
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const ICON_OPTIONS = ['🏷️','🏠','⚡','💧','🌐','📞','👨‍👦','📱','🏦','🛒','🛍️','🍽️','🚗','🎁','❤️','✈️','👶','🐾','🎓','🧾','💳'];

function App() {
  const [state, dispatch] = useReducer(appReducer, initialLoad.state);
  const [period, setPeriod] = useState(initialPeriod);
  const [view, setView] = useState('Overview');
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(initialLoad.warning);
  const [saveEnabled, setSaveEnabled] = useState(!initialLoad.warning);
  const fileRef = useRef(null);

  const mutate = (action) => {
    setSaveEnabled(true);
    dispatch(action);
  };

  useEffect(() => {
    if (!saveEnabled) return;
    const result = saveState(browserStorage, state);
    if (!result.ok) setMessage(result.error);
  }, [state, saveEnabled]);

  useEffect(() => {
    let timerId;
    const syncCurrentPeriod = () => {
      const current = currentLocalPeriod();
      setPeriod((selected) => selected.key === current.key ? selected : current);
    };
    const scheduleCheck = () => {
      clearTimeout(timerId);
      timerId = globalThis.setTimeout(() => {
        syncCurrentPeriod();
        scheduleCheck();
      }, currentPeriodCheckDelay());
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncCurrentPeriod();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    globalThis.addEventListener('pageshow', syncCurrentPeriod);
    scheduleCheck();
    return () => {
      clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
      globalThis.removeEventListener('pageshow', syncCurrentPeriod);
    };
  }, []);

  const monthKey = period.key;
  const summary = useMemo(() => monthSummary(state, monthKey), [state, monthKey]);
  const annual = useMemo(() => annualSummary(state, period.year), [state, period.year]);
  const allCategories = useMemo(() => [...BASE_CATEGORIES, ...state.customCats], [state.customCats]);
  const visibleCategories = allCategories.filter((category) => !state.hiddenCats.includes(category.id));
  const categoryMap = useMemo(() => makeCategoryMap(state.customCats), [state.customCats]);
  const peopleOptions = useMemo(() => [...state.people, ...SPECIAL_PEOPLE], [state.people]);
  const accountOptions = useMemo(() => [...state.accounts, ...SPECIAL_ACCOUNTS], [state.accounts]);
  const peopleMap = useMemo(() => makeReferenceMap(state.people, SPECIAL_PEOPLE), [state.people]);
  const accountMap = useMemo(() => makeReferenceMap(state.accounts, SPECIAL_ACCOUNTS), [state.accounts]);

  const setMonthValue = (value) => {
    if (!isValidMonthKey(value)) return;
    const [year, month] = value.split('-').map(Number);
    setPeriod({ year, month: month - 1, key: value });
  };

  const saveTransactionRecord = ({ record, originalMonthKey }) => {
    if (record.type === 'expense' && !record.category) {
      setMessage('Select an expense category before saving.');
      return false;
    }
    const transaction = normaliseTransaction(record, state.customCats);
    if (!transaction) {
      setMessage('Enter a valid amount, description and date before saving.');
      return false;
    }
    const targetMonthKey = transaction.date.slice(0, 7);
    if (originalMonthKey && originalMonthKey !== targetMonthKey) {
      mutate({ type: 'DELETE_TXN', monthKey: originalMonthKey, id: transaction.id });
      mutate({ type: 'ADD_TXN', monthKey: targetMonthKey, txn: transaction });
    } else if (originalMonthKey) {
      mutate({ type: 'UPDATE_TXN', monthKey: targetMonthKey, txn: transaction });
    } else {
      mutate({ type: 'ADD_TXN', monthKey: targetMonthKey, txn: transaction });
    }
    setModal(null);
    if (transaction.type === 'expense' && (transaction.paidBy === 'unassigned' || transaction.account === 'unassigned')) {
      setMessage('Saved, but Paid By or Account still needs confirmation.');
    } else if (targetMonthKey !== monthKey) {
      setMessage(`Saved to ${MONTHS[Number(targetMonthKey.slice(5, 7)) - 1]} ${targetMonthKey.slice(0, 4)}.`);
    }
    return true;
  };

  const saveIncomeRecord = ({ record, originalMonthKey }) => {
    const targetMonthKey = record.date?.slice(0, 7) || monthKey;
    const income = normaliseIncomeRecord(record, targetMonthKey);
    if (!income) {
      setMessage('Enter a valid income amount, description and date before saving.');
      return false;
    }
    if (originalMonthKey && originalMonthKey !== targetMonthKey) {
      mutate({ type: 'DELETE_INCOME', monthKey: originalMonthKey, id: income.id });
      mutate({ type: 'ADD_INCOME', monthKey: targetMonthKey, record: income });
    } else if (originalMonthKey) {
      mutate({ type: 'UPDATE_INCOME', monthKey: targetMonthKey, record: income });
    } else {
      mutate({ type: 'ADD_INCOME', monthKey: targetMonthKey, record: income });
    }
    setModal(null);
    if (income.receivedBy === 'unassigned' || income.account === 'unassigned') {
      setMessage('Saved, but Received By or Account still needs confirmation.');
    } else if (targetMonthKey !== monthKey) {
      setMessage(`Income saved to ${MONTHS[Number(targetMonthKey.slice(5, 7)) - 1]} ${targetMonthKey.slice(0, 4)}.`);
    }
    return true;
  };

  const deleteTransaction = (transaction) => {
    if (!globalThis.confirm(`Delete “${transaction.desc}” for ${formatMoney(transaction.amount)}?`)) return;
    mutate({ type: 'DELETE_TXN', monthKey: transaction.date.slice(0, 7), id: transaction.id });
  };

  const deleteIncome = (record) => {
    if (!globalThis.confirm(`Delete “${record.description}” for ${formatMoney(record.amount)}?`)) return;
    mutate({ type: 'DELETE_INCOME', monthKey: record.date.slice(0, 7), id: record.id });
  };

  const exportBackup = () => {
    const blob = new Blob([createBackupText(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `penny-backup-${localDateKey()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setMessage('The backup file is larger than 5 MB.');
      return;
    }
    try {
      const backupPackage = parseBackupPackage(await file.text());
      if (backupPackage.importMode === 'merge_months') {
        const monthLabels = backupPackage.mergeMonths.map((key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`);
        const label = monthLabels.join(', ');
        if (!globalThis.confirm(`Merge ${label} into Penny? Existing records for the imported month will be replaced, but all other months will be preserved.`)) return;
        const restored = mergeImportedMonths(state, backupPackage.state, backupPackage.mergeMonths);
        setSaveEnabled(true);
        dispatch({ type: 'RESTORE', state: restored });
        if (backupPackage.mergeMonths.length === 1) setMonthValue(backupPackage.mergeMonths[0]);
        setModal(null);
        setMessage(`${label} merged successfully. Other months were preserved.`);
        return;
      }

      if (!globalThis.confirm('Replace the current Penny data with this backup?')) return;
      setSaveEnabled(true);
      dispatch({ type: 'RESTORE', state: backupPackage.state });
      setModal(null);
      setMessage('Backup imported successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That backup could not be imported.');
    }
  };

  const erasePennyData = () => {
    if (!globalThis.confirm('Erase all data stored by Penny on this device? This cannot be undone without a backup.')) return;
    const result = clearPennyState(browserStorage);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setSaveEnabled(true);
    dispatch({ type: 'RESET' });
    setModal(null);
    setMessage('All Penny data on this device has been erased.');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div className="brand" aria-label="Penny">Penny</div>
          <div className="month-control">
            <input
              className="month-input"
              aria-label="Selected month and year"
              type="month"
              value={monthKey}
              min="1900-01"
              onChange={(event) => setMonthValue(event.target.value)}
            />
          </div>
          <button className="icon-button" aria-label="Settings and backup" onClick={() => setModal({ kind: 'settings' })}>⚙</button>
          <button className="add-button" onClick={() => setModal({ kind: 'record', mode: 'expense' })}>+ Add</button>
        </div>
      </header>

      <main className="content">
        {message && <Notice message={message} onDismiss={() => setMessage('')} />}

        {view === 'Overview' && (
          <Overview
            summary={summary}
            month={period.month}
            year={period.year}
            categoryMap={categoryMap}
            peopleMap={peopleMap}
            accountMap={accountMap}
            onAddIncome={() => setModal({ kind: 'record', mode: 'income' })}
            onAddExpense={() => setModal({ kind: 'record', mode: 'expense' })}
          />
        )}

        {view === 'Transactions' && (
          <Transactions
            summary={summary}
            categoryMap={categoryMap}
            peopleMap={peopleMap}
            accountMap={accountMap}
            onTogglePaid={(transaction) => mutate({ type: 'TOGGLE_PAID', monthKey, id: transaction.id })}
            onEditTransaction={(transaction) => setModal({ kind: 'record', mode: transaction.type === 'expense' ? 'expense' : 'movement', transaction })}
            onEditIncome={(record) => setModal({ kind: 'record', mode: 'income', income: record })}
            onDeleteTransaction={deleteTransaction}
            onDeleteIncome={deleteIncome}
          />
        )}

        {view === 'Bills' && (
          <Bills
            summary={summary}
            categoryMap={categoryMap}
            peopleMap={peopleMap}
            accountMap={accountMap}
            onTogglePaid={(transaction) => mutate({ type: 'TOGGLE_PAID', monthKey, id: transaction.id })}
            onEdit={(transaction) => setModal({ kind: 'record', mode: 'expense', transaction })}
            onAdd={() => setModal({ kind: 'record', mode: 'expense', presetClass: 'fixed' })}
          />
        )}

        {view === 'Savings' && (
          <Savings
            state={state}
            summary={summary}
            monthKey={monthKey}
            month={period.month}
            year={period.year}
            mutate={mutate}
          />
        )}

        {view === 'Year' && (
          <Year
            annual={annual}
            year={period.year}
            categoryMap={categoryMap}
            onSelectMonth={(month) => {
              setPeriod({ year: period.year, month, key: mkKey(period.year, month) });
              setView('Overview');
            }}
          />
        )}
      </main>

      <nav className="nav" aria-label="Primary navigation">
        {['Overview', 'Transactions', 'Bills', 'Savings', 'Year'].map((item) => (
          <button
            key={item}
            className={view === item ? 'active' : ''}
            aria-current={view === item ? 'page' : undefined}
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {modal?.kind === 'record' && (
        <RecordModal
          monthKey={monthKey}
          initialMode={modal.mode}
          presetClass={modal.presetClass}
          transaction={modal.transaction}
          income={modal.income}
          categories={visibleCategories}
          peopleOptions={peopleOptions}
          accountOptions={accountOptions}
          onClose={() => setModal(null)}
          onSaveTransaction={saveTransactionRecord}
          onSaveIncome={saveIncomeRecord}
          onOpenSettings={() => setModal({ kind: 'settings' })}
        />
      )}

      {modal?.kind === 'settings' && (
        <SettingsModal
          state={state}
          allCategories={allCategories}
          mutate={mutate}
          fileRef={fileRef}
          onImport={importBackup}
          onExport={exportBackup}
          onErase={erasePennyData}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Notice({ message, onDismiss }) {
  return (
    <div className="notice" role="status">
      <span>{message}</span>
      <button aria-label="Dismiss message" onClick={onDismiss}>×</button>
    </div>
  );
}

function Stat({ label, value, tone = 'neutral', sub, onClick }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className={`value ${tone}`}>{value}</div>
      <div className="sub">{sub}</div>
    </>
  );
  return onClick ? (
    <button className="card stat stat-button" onClick={onClick} aria-label={`${label}: ${value}. ${sub}`}>{body}</button>
  ) : <div className="card stat">{body}</div>;
}

function Overview({ summary, month, year, categoryMap, peopleMap, accountMap, onAddIncome, onAddExpense }) {
  const categoryTotals = {};
  summary.expenseTransactions.forEach((transaction) => {
    categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + transaction.amount;
  });
  const incomeTotals = {};
  summary.incomeRecords.forEach((record) => {
    const key = `${record.incomeType}::${record.receivedBy}`;
    incomeTotals[key] = (incomeTotals[key] || 0) + record.amount;
  });
  return (
    <>
      {summary.incompleteRecords > 0 && (
        <div className="audit-warning" role="note">
          <strong>{summary.incompleteRecords} record{summary.incompleteRecords === 1 ? '' : 's'} need confirmation.</strong>
          <span>Check payer, receiver, account or source date before relying on the figures as final evidence.</span>
        </div>
      )}

      <div className="grid">
        <Stat label="Current Savings" value={formatMoney(summary.currentSavings)} tone="accent" sub={summary.hasSavingsSnapshot ? `${MONTHS[month]} savings snapshot` : 'No savings snapshot for this month'} />
        <Stat label="Income This Month" value={formatMoney(summary.income)} tone="green" sub="Received or expected" onClick={onAddIncome} />
        <Stat label="Expenses This Month" value={formatMoney(summary.expenses)} tone="amber" sub="Paid and unpaid costs" onClick={onAddExpense} />
        <Stat label="Saved This Month" value={formatMoney(summary.savedThisMonth)} tone={summary.savedThisMonth >= 0 ? 'green' : 'red'} sub="Income − all expenses" />
        <Stat label="Remaining Bills" value={formatMoney(summary.remainingBills)} tone={summary.remainingBills ? 'amber' : 'green'} sub="Still unpaid / to fund" />
        <Stat label="Projected End" value={formatMoney(summary.projectedEndSavings)} tone={summary.projectedEndSavings >= 0 ? 'green' : 'red'} sub="Savings + income − unpaid bills" />
      </div>

      <section className="card" aria-labelledby="transfer-plan-title">
        <div className="section-heading">
          <div>
            <h2 className="section-title" id="transfer-plan-title">Transfer Plan</h2>
            <p className="section-note">Only unpaid expenses are included. Paid bills are not deducted again.</p>
          </div>
          <div className="money strong">{formatMoney(summary.remainingBills)}</div>
        </div>
        {summary.transferPlan.length ? summary.transferPlan.map((row) => (
          <div className="row" key={row.key}>
            <div className="grow">
              <div className="row-title">{peopleMap[row.paidBy]?.label || row.paidBy}</div>
              <div className="muted">{accountMap[row.account]?.label || row.account} · {row.count} item{row.count === 1 ? '' : 's'}</div>
            </div>
            <div className="money">{formatMoney(row.amount)}</div>
          </div>
        )) : <div className="empty">No transfer is currently required. All recorded expenses are marked paid.</div>}
      </section>

      <section className="card" aria-labelledby="transfer-check-title">
        <h2 className="section-title" id="transfer-check-title">Transfer Check</h2>
        <SummaryRow label="Current Savings Now" value={summary.currentSavings} />
        <SummaryRow label="Less: Unpaid Bills Still to Cover" value={-summary.remainingBills} />
        <SummaryRow label="Free Savings After Bills" value={summary.freeSavingsAfterBills} emphasis />
        <SummaryRow label="Plus: Income This Month" value={summary.income} />
        <SummaryRow label="Projected Increase This Month" value={summary.projectedIncrease} />
        <SummaryRow label="Projected End Savings" value={summary.projectedEndSavings} emphasis />
      </section>

      <div className="two-column-sections">
        <section className="card" aria-labelledby="expense-breakdown-title">
          <h2 className="section-title" id="expense-breakdown-title">Expenses — {MONTHS[month]} {year}</h2>
          {Object.keys(categoryTotals).length ? Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([categoryId, amount]) => (
            <div className="row" key={categoryId}>
              <span aria-hidden="true">{categoryMap[categoryId]?.icon || '📦'}</span>
              <div className="grow">{categoryMap[categoryId]?.label || categoryId}</div>
              <div className="money">{formatMoney(amount)}</div>
            </div>
          )) : <div className="empty">No expenses recorded for this month.</div>}
          <div className="summary-strip"><span>Fixed {formatMoney(summary.fixedExpenses)}</span><span>Variable {formatMoney(summary.variableExpenses)}</span></div>
        </section>

        <section className="card" aria-labelledby="income-breakdown-title">
          <h2 className="section-title" id="income-breakdown-title">Income — {MONTHS[month]} {year}</h2>
          {Object.keys(incomeTotals).length ? Object.entries(incomeTotals).sort((a, b) => b[1] - a[1]).map(([key, amount]) => {
            const [type, receivedBy] = key.split('::');
            return (
              <div className="row" key={key}>
                <div className="grow">
                  <div>{type}</div>
                  <div className="muted">{peopleMap[receivedBy]?.label || receivedBy}</div>
                </div>
                <div className="money green">{formatMoney(amount)}</div>
              </div>
            );
          }) : <div className="empty">No income recorded for this month.</div>}
        </section>
      </div>
    </>
  );
}

function SummaryRow({ label, value, emphasis = false }) {
  return (
    <div className={`row ${emphasis ? 'summary-emphasis' : ''}`}>
      <div className="grow">{label}</div>
      <div className={`money ${value >= 0 ? '' : 'red'}`}>{formatMoney(value)}</div>
    </div>
  );
}

function Transactions({ summary, categoryMap, peopleMap, accountMap, onTogglePaid, onEditTransaction, onEditIncome, onDeleteTransaction, onDeleteIncome }) {
  const [tab, setTab] = useState('expenses');
  const [search, setSearch] = useState('');
  const [paidFilter, setPaidFilter] = useState('all');
  const text = search.toLowerCase();
  const expenses = summary.expenseTransactions.filter((transaction) => {
    const matches = `${transaction.desc} ${categoryMap[transaction.category]?.label || ''} ${peopleMap[transaction.paidBy]?.label || ''} ${accountMap[transaction.account]?.label || ''}`.toLowerCase().includes(text);
    const paidMatches = paidFilter === 'all' || (paidFilter === 'paid' ? transaction.paid : !transaction.paid);
    return matches && paidMatches;
  });
  const income = summary.incomeRecords.filter((record) => `${record.description} ${record.incomeType} ${peopleMap[record.receivedBy]?.label || ''} ${accountMap[record.account]?.label || ''}`.toLowerCase().includes(text));
  const movements = summary.transactions.filter((transaction) => transaction.type !== 'expense').filter((transaction) => `${transaction.desc} ${SPECIAL_TRANSACTION_META[transaction.type]?.label || ''}`.toLowerCase().includes(text));

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Transactions sections">
        <button role="tab" aria-selected={tab === 'expenses'} className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>Expenses</button>
        <button role="tab" aria-selected={tab === 'income'} className={tab === 'income' ? 'active' : ''} onClick={() => setTab('income')}>Income</button>
        <button role="tab" aria-selected={tab === 'movements'} className={tab === 'movements' ? 'active' : ''} onClick={() => setTab('movements')}>Transfers</button>
      </div>
      <section className="card filter-card" aria-label="Transaction filters">
        <div className="field compact-field">
          <label htmlFor="transaction-search">Search</label>
          <input id="transaction-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Description, person or account" />
        </div>
        {tab === 'expenses' && (
          <div className="field compact-field">
            <label htmlFor="paid-filter">Payment status</label>
            <select id="paid-filter" value={paidFilter} onChange={(event) => setPaidFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
        )}
      </section>

      {tab === 'expenses' && (
        <section className="card" aria-labelledby="expenses-list-title">
          <h2 className="section-title" id="expenses-list-title">Expenses</h2>
          {expenses.length ? expenses.map((transaction) => (
            <ExpenseRow
              key={transaction.id}
              transaction={transaction}
              categoryMap={categoryMap}
              peopleMap={peopleMap}
              accountMap={accountMap}
              onTogglePaid={onTogglePaid}
              onEdit={onEditTransaction}
              onDelete={onDeleteTransaction}
            />
          )) : <div className="empty">No matching expenses.</div>}
        </section>
      )}

      {tab === 'income' && (
        <section className="card" aria-labelledby="income-list-title">
          <h2 className="section-title" id="income-list-title">Income</h2>
          {income.length ? income.map((record) => (
            <div className="record-row" key={record.id}>
              <div className="record-main">
                <div className="record-title">{record.description}</div>
                <div className="record-meta">{formatDate(record.date)} · {record.incomeType}</div>
                <div className="record-meta">Received by {peopleMap[record.receivedBy]?.label || record.receivedBy} · {accountMap[record.account]?.label || record.account}</div>
                {record.needsConfirmation && <span className="status-pill warning">Needs confirmation</span>}
              </div>
              <div className="record-side">
                <div className="money green">{formatMoney(record.amount)}</div>
                <div className="mini-actions">
                  <button className="secondary-button" onClick={() => onEditIncome(record)}>Edit</button>
                  <button className="danger-button" onClick={() => onDeleteIncome(record)}>Delete</button>
                </div>
              </div>
            </div>
          )) : <div className="empty">No matching income.</div>}
        </section>
      )}

      {tab === 'movements' && (
        <section className="card" aria-labelledby="movements-list-title">
          <h2 className="section-title" id="movements-list-title">Excluded movements</h2>
          <p className="section-note">Internal transfers, savings transfers and card repayments remain visible but do not count as expenses.</p>
          {movements.length ? movements.map((transaction) => (
            <div className="record-row" key={transaction.id}>
              <div className="record-main">
                <div className="record-title">{transaction.desc}</div>
                <div className="record-meta">{formatDate(transaction.date)} · {SPECIAL_TRANSACTION_META[transaction.type]?.label || 'Legacy credit'}</div>
                {transaction.type === 'refund' && <span className="status-pill neutral">Legacy record</span>}
              </div>
              <div className="record-side">
                <div className="money">{formatMoney(transaction.amount)}</div>
                <div className="mini-actions">
                  {transaction.type !== 'refund' && <button className="secondary-button" onClick={() => onEditTransaction(transaction)}>Edit</button>}
                  <button className="danger-button" onClick={() => onDeleteTransaction(transaction)}>Delete</button>
                </div>
              </div>
            </div>
          )) : <div className="empty">No matching transfers or repayments.</div>}
        </section>
      )}
    </>
  );
}

function ExpenseRow({ transaction, categoryMap, peopleMap, accountMap, onTogglePaid, onEdit, onDelete }) {
  return (
    <div className="record-row">
      <div className="record-icon" aria-hidden="true">{categoryMap[transaction.category]?.icon || '📦'}</div>
      <div className="record-main">
        <div className="record-title">{transaction.desc}</div>
        <div className="record-meta">{formatDate(transaction.date)} · {categoryMap[transaction.category]?.label || transaction.category} · {transaction.expenseClass === 'fixed' ? 'Fixed' : 'Variable'}</div>
        <div className="record-meta">{peopleMap[transaction.paidBy]?.label || transaction.paidBy} · {accountMap[transaction.account]?.label || transaction.account}</div>
        <div className="pill-line">
          <span className={`status-pill ${transaction.paid ? 'success' : 'warning'}`}>{transaction.paid ? 'Paid' : 'Unpaid'}</span>
          {transaction.needsConfirmation && <span className="status-pill warning">Needs confirmation</span>}
        </div>
      </div>
      <div className="record-side">
        <div className="money">{formatMoney(transaction.amount)}</div>
        <div className="mini-actions">
          <button className="secondary-button" onClick={() => onTogglePaid(transaction)}>{transaction.paid ? 'Mark unpaid' : 'Mark paid'}</button>
          <button className="secondary-button" onClick={() => onEdit(transaction)}>Edit</button>
          <button className="danger-button" onClick={() => onDelete(transaction)}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function Bills({ summary, categoryMap, peopleMap, accountMap, onTogglePaid, onEdit, onAdd }) {
  const bills = summary.expenseTransactions
    .filter((transaction) => transaction.expenseClass === 'fixed')
    .sort((a, b) => Number(a.paid) - Number(b.paid) || a.date.localeCompare(b.date));
  return (
    <>
      <div className="grid compact-grid">
        <Stat label="Fixed Costs" value={formatMoney(summary.fixedExpenses)} tone="amber" sub="All recorded fixed expenses" />
        <Stat label="Still to Fund" value={formatMoney(bills.filter((bill) => !bill.paid).reduce((sum, bill) => sum + bill.amount, 0))} tone={bills.some((bill) => !bill.paid) ? 'amber' : 'green'} sub="Unpaid fixed costs only" />
      </div>
      <section className="card" aria-labelledby="monthly-bills-title">
        <div className="section-heading">
          <div>
            <h2 className="section-title" id="monthly-bills-title">Monthly Bills</h2>
            <p className="section-note">Each bill records who is responsible, the payment account and whether it is already paid.</p>
          </div>
          <button className="primary-button" onClick={onAdd}>+ Add bill</button>
        </div>
        {bills.length ? bills.map((transaction) => (
          <div className="bill-row" key={transaction.id}>
            <div className="record-icon" aria-hidden="true">{categoryMap[transaction.category]?.icon || '🧾'}</div>
            <div className="grow">
              <div className="row-title">{transaction.desc}</div>
              <div className="muted">{peopleMap[transaction.paidBy]?.label || transaction.paidBy} · {accountMap[transaction.account]?.label || transaction.account}</div>
              <span className={`status-pill ${transaction.paid ? 'success' : 'warning'}`}>{transaction.paid ? 'Paid' : 'Unpaid'}</span>
            </div>
            <div className="bill-actions">
              <div className="money">{formatMoney(transaction.amount)}</div>
              <button className="secondary-button" onClick={() => onTogglePaid(transaction)}>{transaction.paid ? 'Unpaid' : 'Paid'}</button>
              <button className="secondary-button" onClick={() => onEdit(transaction)}>Edit</button>
            </div>
          </div>
        )) : <div className="empty">No fixed bills recorded for this month.</div>}
      </section>
    </>
  );
}

function Savings({ state, summary, monthKey, month, year, mutate }) {
  const savingsAccounts = state.savingsByMonth?.[monthKey] || [];
  const setAccounts = (items) => mutate({ type: 'SET_SAVINGS_ACCOUNTS', monthKey, items });
  const updateAccount = (id, patch) => {
    setAccounts(savingsAccounts.map((account) => account.id === id ? { ...account, ...patch } : account));
  };
  const addAccount = () => {
    setAccounts([...savingsAccounts, { id: createId('saving'), label: 'New savings account', balance: 0 }]);
  };
  const removeAccount = (id) => {
    const account = savingsAccounts.find((item) => item.id === id);
    if (account?.balance && !globalThis.confirm(`Remove ${account.label} with a recorded balance of ${formatMoney(account.balance)}?`)) return;
    setAccounts(savingsAccounts.filter((item) => item.id !== id));
  };
  const goalRemaining = state.savingsGoal > 0 ? Math.max(state.savingsGoal - summary.currentSavings, 0) : null;
  const months = goalRemaining && state.savingsContrib > 0 ? Math.ceil(goalRemaining / state.savingsContrib) : null;
  return (
    <>
      <section className="card" aria-labelledby="savings-accounts-title">
        <div className="section-heading">
          <div>
            <h2 className="section-title" id="savings-accounts-title">Savings Accounts — {MONTHS[month]} {year}</h2>
            <p className="section-note">This is a month-specific savings snapshot. Editing it does not change another month.</p>
          </div>
          <button className="primary-button" onClick={addAccount}>+ Account</button>
        </div>
        {savingsAccounts.length ? savingsAccounts.map((account) => (
          <div className="savings-account-row" key={account.id}>
            <div className="field grow compact-field">
              <label htmlFor={`saving-label-${account.id}`}>Account</label>
              <input id={`saving-label-${account.id}`} value={account.label} onChange={(event) => updateAccount(account.id, { label: event.target.value.slice(0, 80) })} />
            </div>
            <div className="field amount-field compact-field">
              <label htmlFor={`saving-balance-${account.id}`}>Balance</label>
              <input id={`saving-balance-${account.id}`} type="number" inputMode="decimal" min="0" step="0.01" value={account.balance || ''} placeholder="0.00" onChange={(event) => updateAccount(account.id, { balance: Math.max(0, Number(event.target.value) || 0) })} />
            </div>
            <button className="danger-button remove-row-button" onClick={() => removeAccount(account.id)}>Remove</button>
          </div>
        )) : <div className="empty">No savings snapshot has been recorded for {MONTHS[month]} {year}.</div>}
        <div className="total-line"><span>Current Savings</span><span className="money green">{formatMoney(summary.currentSavings)}</span></div>
      </section>

      <section className="card" aria-labelledby="savings-goal-title">
        <h2 className="section-title" id="savings-goal-title">Savings Goal</h2>
        <div className="form-grid">
          <NumberField label="Goal" value={state.savingsGoal} onChange={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsGoal', value })} />
          <NumberField label="Monthly Contribution" value={state.savingsContrib} onChange={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsContrib', value })} />
        </div>
        <SummaryRow label="Remaining" value={goalRemaining ?? 0} />
        <div className="row"><div className="grow">Forecast</div><div>{state.savingsGoal ? (goalRemaining === 0 ? 'Goal reached' : months ? `${months} months` : 'Set monthly contribution') : 'Set a goal'}</div></div>
      </section>
    </>
  );
}

function NumberField({ label, value, onChange }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={value || ''} placeholder="0.00" onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Year({ annual, year, categoryMap, onSelectMonth }) {
  const categoryTotals = {};
  annual.months.forEach((item) => item.expenseTransactions.forEach((transaction) => {
    categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + transaction.amount;
  }));
  return (
    <>
      <div className="grid">
        <Stat label={`${year} Income`} value={formatMoney(annual.income)} tone="green" sub={`${annual.withData.length} months with records`} />
        <Stat label={`${year} Expenses`} value={formatMoney(annual.expenses)} tone="amber" sub="All paid and unpaid costs" />
        <Stat label={`${year} Saved`} value={formatMoney(annual.savedThisMonth)} tone={annual.savedThisMonth >= 0 ? 'green' : 'red'} sub="Income − expenses" />
        <Stat label="Fixed Costs" value={formatMoney(annual.fixedExpenses)} tone="amber" sub="Recorded fixed costs" />
        <Stat label="Variable Costs" value={formatMoney(annual.variableExpenses)} tone="amber" sub="Recorded variable costs" />
        <Stat label="Excluded Movements" value={formatMoney(annual.excludedMovements)} sub="Transfers and card repayments" />
      </div>
      <section className="card" aria-labelledby="months-title">
        <h2 className="section-title" id="months-title">Month by Month</h2>
        {annual.months.map((item) => (
          <button className={`year-row ${item.incomeRecords.length || item.transactions.length ? '' : 'no-data'}`} key={item.key} onClick={() => onSelectMonth(item.month)}>
            <span className="month-name">{SHORT_MONTHS[item.month]}</span>
            <span className="grow muted">{item.incomeRecords.length || item.transactions.length ? `${formatMoney(item.income)} in · ${formatMoney(item.expenses)} out` : 'No records'}</span>
            <span className={`money ${item.savedThisMonth >= 0 ? 'green' : 'red'}`}>{item.incomeRecords.length || item.transactions.length ? formatMoney(item.savedThisMonth, { plus: true }) : '—'}</span>
          </button>
        ))}
      </section>
      <section className="card" aria-labelledby="year-categories-title">
        <h2 className="section-title" id="year-categories-title">Expenses by Category</h2>
        {Object.keys(categoryTotals).length ? Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([categoryId, total]) => (
          <div className="row" key={categoryId}>
            <span aria-hidden="true">{categoryMap[categoryId]?.icon || '📦'}</span>
            <div className="grow">{categoryMap[categoryId]?.label || categoryId}</div>
            <div className="money">{formatMoney(total)}</div>
          </div>
        )) : <div className="empty">No expenses recorded for {year}.</div>}
      </section>
    </>
  );
}

function RecordModal({ monthKey, initialMode, presetClass, transaction, income, categories, peopleOptions, accountOptions, onClose, onSaveTransaction, onSaveIncome, onOpenSettings }) {
  const lockedMode = Boolean(transaction || income);
  const [mode, setMode] = useState(initialMode || 'expense');
  const [description, setDescription] = useState(transaction?.desc || income?.description || '');
  const [amount, setAmount] = useState(transaction?.amount || income?.amount || '');
  const [date, setDate] = useState(transaction?.date || income?.date || (monthKey === currentLocalPeriod().key ? localDateKey() : `${monthKey}-01`));
  const [category, setCategory] = useState(transaction?.category || '');
  const selectedCategory = categories.find((item) => item.id === category);
  const [expenseClass, setExpenseClass] = useState(transaction?.expenseClass || presetClass || selectedCategory?.defaultClass || 'variable');
  const [paid, setPaid] = useState(transaction?.paid ?? true);
  const [paidBy, setPaidBy] = useState(transaction?.paidBy || 'unassigned');
  const [account, setAccount] = useState(transaction?.account || income?.account || 'unassigned');
  const [receivedBy, setReceivedBy] = useState(income?.receivedBy || 'unassigned');
  const [incomeType, setIncomeType] = useState(income?.incomeType || '');
  const [movementType, setMovementType] = useState(transaction?.type && transaction.type !== 'expense' ? transaction.type : 'internal_transfer');

  const save = () => {
    if (mode === 'income') {
      onSaveIncome({
        originalMonthKey: income?.date?.slice(0, 7),
        record: {
          id: income?.id || createId('income'),
          date,
          amount,
          description,
          incomeType,
          receivedBy,
          account,
          needsConfirmation: receivedBy === 'unassigned' || account === 'unassigned',
        },
      });
      return;
    }
    const type = mode === 'movement' ? movementType : 'expense';
    onSaveTransaction({
      originalMonthKey: transaction?.date?.slice(0, 7),
      record: {
        id: transaction?.id || createId('txn'),
        type,
        date,
        amount,
        desc: description,
        category: type === 'expense' ? category : type,
        expenseClass,
        paid: type === 'expense' ? paid : true,
        paidBy: type === 'expense' ? paidBy : '',
        account,
        needsConfirmation: type === 'expense' && (paidBy === 'unassigned' || account === 'unassigned'),
      },
    });
  };

  return (
    <SimpleModal title={transaction || income ? 'Edit record' : 'Add record'} onClose={onClose}>
      {!lockedMode && (
        <div className="tabs record-tabs" role="tablist" aria-label="Record type">
          <button role="tab" aria-selected={mode === 'expense'} className={mode === 'expense' ? 'active' : ''} onClick={() => setMode('expense')}>Expense</button>
          <button role="tab" aria-selected={mode === 'income'} className={mode === 'income' ? 'active' : ''} onClick={() => setMode('income')}>Income</button>
          <button role="tab" aria-selected={mode === 'movement'} className={mode === 'movement' ? 'active' : ''} onClick={() => setMode('movement')}>Transfer</button>
        </div>
      )}

      {mode === 'movement' && (
        <div className="field">
          <label htmlFor="movement-type">Movement type</label>
          <select id="movement-type" value={movementType} onChange={(event) => setMovementType(event.target.value)}>
            {MOVEMENT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <small>{MOVEMENT_TYPES.find((item) => item.id === movementType)?.impact}</small>
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="record-description">Description</label>
          <input id="record-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={mode === 'income' ? 'Paycheck, benefit or other source' : 'Bill, merchant or note'} />
        </div>
        <div className="field">
          <label htmlFor="record-amount">Amount</label>
          <input id="record-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="record-date">Date</label>
        <input id="record-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      {mode === 'expense' && (
        <>
          <div className="field">
            <label htmlFor="record-category">Category</label>
            <select id="record-category" value={category} onChange={(event) => {
              const next = event.target.value;
              setCategory(next);
              const nextCategory = categories.find((item) => item.id === next);
              if (nextCategory) setExpenseClass(nextCategory.defaultClass || 'variable');
            }}>
              <option value="">Select category</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}</option>)}
            </select>
          </div>
          <fieldset className="choice-group">
            <legend>Expense type</legend>
            <label className={expenseClass === 'fixed' ? 'choice-card selected' : 'choice-card'}>
              <input type="radio" name="expense-class" value="fixed" checked={expenseClass === 'fixed'} onChange={() => setExpenseClass('fixed')} />
              <span><strong>Fixed</strong><small>Regular committed cost</small></span>
            </label>
            <label className={expenseClass === 'variable' ? 'choice-card selected' : 'choice-card'}>
              <input type="radio" name="expense-class" value="variable" checked={expenseClass === 'variable'} onChange={() => setExpenseClass('variable')} />
              <span><strong>Variable</strong><small>Flexible household spending</small></span>
            </label>
          </fieldset>
          <fieldset className="choice-group">
            <legend>Payment status</legend>
            <label className={paid ? 'choice-card selected' : 'choice-card'}>
              <input type="radio" name="payment-status" checked={paid} onChange={() => setPaid(true)} />
              <span><strong>Paid</strong><small>Already reflected in live savings</small></span>
            </label>
            <label className={!paid ? 'choice-card selected' : 'choice-card'}>
              <input type="radio" name="payment-status" checked={!paid} onChange={() => setPaid(false)} />
              <span><strong>Unpaid</strong><small>Included in transfer plan</small></span>
            </label>
          </fieldset>
          <div className="form-grid">
            <ReferenceSelect id="record-paid-by" label="Paid By" value={paidBy} options={peopleOptions} onChange={setPaidBy} />
            <ReferenceSelect id="record-account" label="Account" value={account} options={accountOptions} onChange={setAccount} />
          </div>
        </>
      )}

      {mode === 'income' && (
        <>
          <div className="field">
            <label htmlFor="income-type">Income type</label>
            <input id="income-type" value={incomeType} onChange={(event) => setIncomeType(event.target.value)} placeholder="Employment, Benefits, Child Benefit…" />
          </div>
          <div className="form-grid">
            <ReferenceSelect id="income-received-by" label="Received By" value={receivedBy} options={peopleOptions} onChange={setReceivedBy} />
            <ReferenceSelect id="income-account" label="Account" value={account} options={accountOptions} onChange={setAccount} />
          </div>
        </>
      )}

      {mode === 'movement' && <ReferenceSelect id="movement-account" label="Account / card" value={account} options={accountOptions} onChange={setAccount} />}

      <button className="text-button" type="button" onClick={onOpenSettings}>Manage people, accounts and categories in Settings</button>
      <div className="actions">
        <button className="secondary-button" onClick={onClose}>Cancel</button>
        <button className="primary-button" onClick={save}>Save</button>
      </div>
    </SimpleModal>
  );
}

function ReferenceSelect({ id, label, value, options, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
  );
}

function SettingsModal({ state, allCategories, mutate, fileRef, onImport, onExport, onErase, onClose }) {
  return (
    <SimpleModal title="Settings" onClose={onClose} wide>
      <section className="settings-section">
        <h3>Household People</h3>
        <p className="section-note">Used for Paid By and Received By. Household and Unassigned are always available.</p>
        <ReferenceEditor field="people" items={state.people} state={state} mutate={mutate} placeholder="Person name" />
      </section>
      <section className="settings-section">
        <h3>Accounts</h3>
        <p className="section-note">Add bank accounts and cards used by expenses or income.</p>
        <ReferenceEditor field="accounts" items={state.accounts} state={state} mutate={mutate} placeholder="Account name" />
      </section>
      <section className="settings-section">
        <CategoryManager categories={allCategories} state={state} mutate={mutate} />
      </section>
      <section className="settings-section">
        <h3>Backup and Restore</h3>
        <p className="section-note">Normal backups can replace all browser data. Month-merge packages add or replace only their specified month and preserve every other month.</p>
        <div className="actions stacked-actions">
          <button className="primary-button" onClick={onExport}>Export backup</button>
          <button className="secondary-button" onClick={() => fileRef.current?.click()}>Import backup</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        <button className="danger-button full-width" onClick={onErase}>Erase Penny data on this device</button>
      </section>
    </SimpleModal>
  );
}

function ReferenceEditor({ field, items, state, mutate, placeholder }) {
  const [newLabel, setNewLabel] = useState('');
  const update = (id, label) => mutate({ type: 'SET_REFERENCE_LIST', field, items: items.map((item) => item.id === id ? { ...item, label: label.slice(0, 80) } : item) });
  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    mutate({ type: 'SET_REFERENCE_LIST', field, items: [...items, { id: createId(field === 'people' ? 'person' : 'account'), label: label.slice(0, 80) }] });
    setNewLabel('');
  };
  const remove = (id) => {
    if (referenceInUse(state, field, id)) return;
    mutate({ type: 'SET_REFERENCE_LIST', field, items: items.filter((item) => item.id !== id) });
  };
  return (
    <>
      {items.map((item) => {
        const inUse = referenceInUse(state, field, item.id);
        return (
          <div className="settings-row" key={item.id}>
            <input aria-label={`${field} name`} value={item.label} onChange={(event) => update(item.id, event.target.value)} />
            <button className="danger-button" disabled={inUse} title={inUse ? 'Used by existing records' : 'Remove'} onClick={() => remove(item.id)}>{inUse ? 'In use' : 'Remove'}</button>
          </div>
        );
      })}
      <div className="settings-row">
        <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder={placeholder} />
        <button className="primary-button" disabled={!newLabel.trim()} onClick={add}>Add</button>
      </div>
    </>
  );
}

function CategoryManager({ categories, state, mutate }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [defaultClass, setDefaultClass] = useState('variable');
  const add = () => {
    const label = name.trim();
    if (!label) return;
    mutate({
      type: 'ADD_CAT',
      cat: {
        id: createId('category'),
        label: label.slice(0, 80),
        icon,
        group: defaultClass === 'fixed' ? 'Bills' : 'Other',
        defaultClass,
        fixed: false,
      },
    });
    setName('');
    setIcon('🏷️');
    setDefaultClass('variable');
  };
  return (
    <>
      <h3>Categories</h3>
      <p className="section-note">Category type sets the default when a new expense is added. It can still be changed on the record.</p>
      <div className="field">
        <label htmlFor="category-name">New category</label>
        <input id="category-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="For example: Childcare" />
      </div>
      <fieldset className="choice-group compact-choices">
        <legend>Default type</legend>
        <label className={defaultClass === 'variable' ? 'choice-card selected' : 'choice-card'}>
          <input type="radio" name="category-default" checked={defaultClass === 'variable'} onChange={() => setDefaultClass('variable')} />
          <span><strong>Variable</strong></span>
        </label>
        <label className={defaultClass === 'fixed' ? 'choice-card selected' : 'choice-card'}>
          <input type="radio" name="category-default" checked={defaultClass === 'fixed'} onChange={() => setDefaultClass('fixed')} />
          <span><strong>Fixed</strong></span>
        </label>
      </fieldset>
      <fieldset className="icon-picker">
        <legend>Choose an icon</legend>
        <div className="icon-grid">
          {ICON_OPTIONS.map((option) => (
            <button type="button" key={option} className={icon === option ? 'icon-choice selected' : 'icon-choice'} aria-pressed={icon === option} onClick={() => setIcon(option)}>{option}</button>
          ))}
        </div>
      </fieldset>
      <button className="primary-button full-width" disabled={!name.trim()} onClick={add}>Add category</button>
      <details className="category-list">
        <summary>Manage existing categories</summary>
        <div className="category-list-body">
          {categories.map((category) => {
            const custom = !category.fixed;
            const inUse = categoryInUse(state, category.id);
            return (
              <div className="settings-row category-settings-row" key={category.id}>
                <span aria-hidden="true">{category.icon}</span>
                <div className="grow"><div>{category.label}</div><div className="muted">{category.defaultClass === 'fixed' ? 'Fixed' : 'Variable'}</div></div>
                <button className="secondary-button" onClick={() => mutate({ type: 'TOGGLE_HIDE', id: category.id })}>{state.hiddenCats.includes(category.id) ? 'Show' : 'Hide'}</button>
                {custom && <button className="danger-button" disabled={inUse} onClick={() => !inUse && mutate({ type: 'REMOVE_CAT', id: category.id })}>{inUse ? 'In use' : 'Delete'}</button>}
              </div>
            );
          })}
        </div>
      </details>
    </>
  );
}

function SimpleModal({ title, onClose, children, wide = false }) {
  const titleId = `modal-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const closeRef = useRef(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className={`modal-inner ${wide ? 'wide-modal' : ''}`}>
        <div className="modal-head">
          <h2 className="section-title" id={titleId}>{title}</h2>
          <button ref={closeRef} className="secondary-button" onClick={onClose}>Done</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default App;
