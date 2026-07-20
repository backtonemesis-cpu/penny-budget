import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  BASE_CATEGORIES,
  SPECIAL_TRANSACTION_META,
  TRANSACTION_TREATMENTS,
  makeCategoryMap,
} from './catalog.js';
import { currentLocalPeriod, currentPeriodCheckDelay } from './current-period.js';
import {
  MONTHS,
  SHORT_MONTHS,
  annualSummary,
  createId,
  dueStatus,
  formatDate,
  formatMoney,
  getMonthBudgets,
  isValidMonthKey,
  localDateKey,
  mkKey,
  monthSummary,
  normaliseTransaction,
  positiveNumber,
  previousMonthKey,
} from './finance.js';
import { appReducer, categoryInUse } from './state.js';
import {
  clearPennyState,
  createBackupText,
  getBrowserStorage,
  loadState,
  parseBackupText,
  saveState,
} from './storage.js';
import './styles.css';

const browserStorage = getBrowserStorage();
const initialLoad = loadState(browserStorage, new Date());
const initialPeriod = currentLocalPeriod();
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

function App() {
  const [state, dispatch] = useReducer(appReducer, initialLoad.state);
  const [period, setPeriod] = useState(initialPeriod);
  const [view, setView] = useState('Overview');
  const [billsTab, setBillsTab] = useState('bills');
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
  const categoryMap = useMemo(() => makeCategoryMap(state.customCats), [state.customCats]);
  const visibleCategories = allCategories.filter((category) => !state.hiddenCats.includes(category.id));
  const billCategories = visibleCategories.filter((category) => category.bill);
  const budgets = getMonthBudgets(state, monthKey);
  const priorMonthKey = previousMonthKey(monthKey);
  const priorBudgets = priorMonthKey ? getMonthBudgets(state, priorMonthKey) : {};

  const spentByCategory = useMemo(() => {
    const totals = {};
    summary.transactions
      .filter((transaction) => transaction.type === 'expense')
      .forEach((transaction) => {
        totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount;
      });
    return totals;
  }, [summary.transactions]);

  const setMonthValue = (value) => {
    if (!isValidMonthKey(value)) return;
    const [year, month] = value.split('-').map(Number);
    setPeriod({ year, month: month - 1, key: value });
  };

  const addTransaction = (payload) => {
    const amount = positiveNumber(payload.amount);
    const needsCategory = payload.type === 'expense' || payload.type === 'refund';
    if (!amount || !payload.date || (needsCategory && !payload.category)) {
      setMessage('Enter an amount, date and category before saving.');
      return;
    }

    const selectedCategory = needsCategory ? payload.category : payload.type;
    const category = categoryMap[selectedCategory];
    const transaction = normaliseTransaction({
      id: createId('txn'),
      type: payload.type,
      amount,
      category: selectedCategory,
      date: payload.date,
      desc: payload.desc,
      expenseClass: payload.type === 'expense' && category?.bill ? 'fixed' : 'spending',
      isBillPayment: Boolean(payload.isBillPayment),
    });

    if (!transaction) {
      setMessage('That transaction could not be validated.');
      return;
    }

    const targetMonthKey = transaction.date.slice(0, 7);
    mutate({ type: 'ADD_TXN', monthKey: targetMonthKey, txn: transaction });
    setModal(null);
    if (targetMonthKey !== monthKey) {
      setMessage(`Transaction saved to ${MONTHS[Number(targetMonthKey.slice(5, 7)) - 1]} ${targetMonthKey.slice(0, 4)}.`);
    }
  };

  const deleteTransaction = (transaction) => {
    if (!globalThis.confirm(`Delete “${transaction.desc}” for ${formatMoney(transaction.amount)}?`)) return;
    mutate({ type: 'DELETE_TXN', monthKey, id: transaction.id });
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
      const restored = parseBackupText(await file.text());
      if (!globalThis.confirm('Replace the current Penny data with this backup?')) return;
      setSaveEnabled(true);
      dispatch({ type: 'RESTORE', state: restored });
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

  const openBudgets = () => {
    setView('Bills');
    setBillsTab('budgets');
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
          <button className="icon-button" aria-label="Backup and restore" onClick={() => setModal('backup')}>☁︎</button>
          <button className="add-button" onClick={() => setModal('add')}>+ Add</button>
        </div>
      </header>

      <main className="content">
        {message && <Notice message={message} onDismiss={() => setMessage('')} />}

        {view === 'Overview' && (
          <Overview
            summary={summary}
            annual={annual}
            budgets={budgets}
            spentByCategory={spentByCategory}
            categoryMap={categoryMap}
            month={period.month}
            year={period.year}
            onIncome={() => setModal('income')}
            onTransactions={() => setView('Transactions')}
            onBudgets={openBudgets}
          />
        )}

        {view === 'Transactions' && (
          <Transactions
            transactions={summary.transactions}
            categoryMap={categoryMap}
            onDelete={deleteTransaction}
          />
        )}

        {view === 'Bills' && (
          <Bills
            state={state}
            monthKey={monthKey}
            year={period.year}
            month={period.month}
            categories={visibleCategories}
            billCategories={billCategories}
            budgets={budgets}
            priorMonthKey={priorMonthKey}
            priorBudgets={priorBudgets}
            spentByCategory={spentByCategory}
            transactions={summary.transactions}
            tab={billsTab}
            setTab={setBillsTab}
            mutate={mutate}
            addTransaction={addTransaction}
          />
        )}

        {view === 'Savings' && <Savings state={state} annual={annual} mutate={mutate} />}

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

      {modal === 'add' && (
        <TransactionModal
          monthKey={monthKey}
          categories={visibleCategories}
          allCategories={allCategories}
          state={state}
          mutate={mutate}
          onClose={() => setModal(null)}
          onSave={addTransaction}
        />
      )}

      {modal === 'income' && (
        <IncomeModal
          sources={summary.incomeSources}
          onClose={() => setModal(null)}
          onSave={(sources) => {
            mutate({ type: 'SET_INCOME', monthKey, sources });
            setModal(null);
          }}
        />
      )}

      {modal === 'backup' && (
        <SimpleModal title="Backup and restore" onClose={() => setModal(null)}>
          <p className="rule-note">Backups contain Penny data only. Penny does not read or change your Excel tracker.</p>
          <div className="actions">
            <button className="primary-button" onClick={exportBackup}>Export backup</button>
            <button className="secondary-button" onClick={() => fileRef.current?.click()}>Import backup</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
          <button className="danger-button" style={{ width: '100%', marginTop: 14 }} onClick={erasePennyData}>Erase Penny data on this device</button>
        </SimpleModal>
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

function Overview({ summary, annual, budgets, spentByCategory, categoryMap, month, year, onIncome, onTransactions, onBudgets }) {
  const topCategories = Object.entries(spentByCategory).sort((a, b) => b[1] - a[1]);
  const totalBudget = Object.values(budgets).reduce((sum, amount) => sum + amount, 0);

  return (
    <>
      <div className="grid">
        <Stat label="Income" value={formatMoney(summary.income)} tone="green" sub="This month" onClick={onIncome} />
        <Stat label="Refunds / credits" value={formatMoney(summary.refunds)} tone="green" sub="Money returned" onClick={onTransactions} />
        <Stat label="Fixed bills" value={formatMoney(summary.fixedBills)} tone="amber" sub="Recorded fixed costs" onClick={onTransactions} />
        <Stat label="Gross spending" value={formatMoney(summary.grossSpending)} tone="amber" sub="Before refunds" onClick={onTransactions} />
        <Stat label="Available" value={formatMoney(summary.available)} tone={summary.available >= 0 ? 'green' : 'red'} sub="Income + refunds − bills − spending" />
        <Stat label="Budgets" value={totalBudget ? formatMoney(totalBudget) : 'Set up'} tone="accent" sub="Month-specific controls" onClick={onBudgets} />
      </div>

      {summary.excludedTransfers > 0 && (
        <div className="notice" role="note">
          <span>{formatMoney(summary.excludedTransfers)} of internal, savings or card transfers remains visible but is excluded from income and spending.</span>
        </div>
      )}

      <section className="card" aria-labelledby="spending-title">
        <h2 className="section-title" id="spending-title">Outgoings — {MONTHS[month]} {year}</h2>
        {topCategories.length ? topCategories.map(([categoryId, amount]) => (
          <div className="row" key={categoryId}>
            <span aria-hidden="true">{categoryMap[categoryId]?.icon || '📦'}</span>
            <div className="grow ellipsis">{categoryMap[categoryId]?.label || categoryId}</div>
            <div className="money">{formatMoney(amount)}</div>
          </div>
        )) : <div className="empty">No outgoings recorded for this month.</div>}
      </section>

      <section className="card" aria-labelledby="year-snapshot-title">
        <h2 className="section-title" id="year-snapshot-title">{year} snapshot</h2>
        <div className="row"><div className="grow">Months with data</div><div>{annual.withData.length}</div></div>
        <div className="row"><div className="grow">Available to date</div><div className={`money ${annual.available >= 0 ? 'green' : 'red'}`}>{formatMoney(annual.available)}</div></div>
      </section>
    </>
  );
}

function Stat({ label, value, tone, sub, onClick }) {
  const content = (
    <>
      <div className="label">{label}</div>
      <div className={`value ${tone === 'accent' ? '' : tone}`} style={tone === 'accent' ? { color: 'var(--accent)' } : undefined}>{value}</div>
      <div className="sub">{sub}</div>
    </>
  );

  return onClick ? (
    <button className="card stat stat-button" onClick={onClick} aria-label={`${label}: ${value}. ${sub}`}>{content}</button>
  ) : (
    <div className="card stat">{content}</div>
  );
}

function transactionTreatment(transaction) {
  if (transaction.type === 'expense') return transaction.expenseClass === 'fixed' ? 'Fixed bill' : 'Spending';
  return SPECIAL_TRANSACTION_META[transaction.type]?.label || 'Refund / credit';
}

function transactionAmount(transaction) {
  if (transaction.type === 'refund') return { text: formatMoney(transaction.amount, { plus: true }), tone: 'green' };
  if (transaction.type === 'expense') return { text: formatMoney(-transaction.amount), tone: '' };
  return { text: `${formatMoney(transaction.amount)} excluded`, tone: 'neutral' };
}

function Transactions({ transactions, categoryMap, onDelete }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const filtered = transactions.filter((transaction) => {
    const matchesText = `${transaction.desc} ${categoryMap[transaction.category]?.label || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || transaction.type === filter;
    return matchesText && matchesFilter;
  });

  return (
    <>
      <section className="card" aria-label="Transaction filters">
        <div className="search-controls">
          <div className="field">
            <label htmlFor="transaction-search">Search</label>
            <input id="transaction-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Merchant or category" />
          </div>

        </div>
        <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
          <label htmlFor="transaction-filter">Treatment</label>
          <select id="transaction-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All transactions</option>
            {TRANSACTION_TREATMENTS.map((treatment) => <option key={treatment.id} value={treatment.id}>{treatment.label}</option>)}
          </select>
        </div>
      </section>

      <section className="card" aria-labelledby="transactions-title">
        <h2 className="section-title" id="transactions-title">Transactions</h2>
        {filtered.length ? filtered.map((transaction) => {
          const amount = transactionAmount(transaction);
          const meta = SPECIAL_TRANSACTION_META[transaction.type];
          return (
            <div className="row" key={transaction.id}>
              <span aria-hidden="true">{meta?.icon || (transaction.type === 'refund' ? '↩️' : categoryMap[transaction.category]?.icon || '📦')}</span>
              <div className="grow">
                <div className="ellipsis">{transaction.desc}</div>
                <div className="muted">{formatDate(transaction.date)} · {categoryMap[transaction.category]?.label || meta?.label || transaction.category}</div>
                <span className="transaction-treatment">{transactionTreatment(transaction)}</span>
              </div>
              <div className={`money ${amount.tone}`}>{amount.text}</div>
              <button className="danger-button" aria-label={`Delete ${transaction.desc}`} onClick={() => onDelete(transaction)}>×</button>
            </div>
          );
        }) : <div className="empty">No matching transactions.</div>}
      </section>
    </>
  );
}

function Bills({ state, monthKey, year, month, categories, billCategories, budgets, priorMonthKey, priorBudgets, spentByCategory, transactions, tab, setTab, mutate, addTransaction }) {
  const paidByCategory = useMemo(() => {
    const totals = {};
    transactions
      .filter((transaction) => transaction.type === 'expense' && (transaction.expenseClass === 'fixed' || billCategories.some((category) => category.id === transaction.category)))
      .forEach((transaction) => {
        totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount;
      });
    return totals;
  }, [transactions, billCategories]);

  const markBillPaid = (category, remainingAmount) => {
    const dueDay = state.dueDays[category.id];
    if (!dueDay || remainingAmount <= 0) return;
    const today = localDateKey();
    const paymentDate = today.slice(0, 7) === monthKey
      ? today
      : `${monthKey}-${String(Math.min(dueDay, new Date(year, month + 1, 0).getDate())).padStart(2, '0')}`;
    addTransaction({
      type: 'expense',
      amount: remainingAmount,
      category: category.id,
      date: paymentDate,
      desc: category.label,
      isBillPayment: true,
    });
  };

  const pendingBills = billCategories.flatMap((category) => {
    const budget = budgets[category.id] || 0;
    const paid = paidByCategory[category.id] || 0;
    const dueDay = state.dueDays[category.id];
    const remaining = Math.max(budget - paid, 0);
    return budget > 0 && dueDay && remaining > 0 ? [{ category, remaining }] : [];
  });

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Bills and budgets">
        <button role="tab" aria-selected={tab === 'bills'} className={tab === 'bills' ? 'active' : ''} onClick={() => setTab('bills')}>Bills</button>
        <button role="tab" aria-selected={tab === 'budgets'} className={tab === 'budgets' ? 'active' : ''} onClick={() => setTab('budgets')}>Budgets</button>
      </div>

      {tab === 'bills' ? (
        <section className="card" aria-labelledby="bills-title">
          <h2 className="section-title" id="bills-title">Monthly bills</h2>
          {billCategories.map((category) => {
            const budget = budgets[category.id] || 0;
            const paidAmount = paidByCategory[category.id] || 0;
            const dueDay = state.dueDays[category.id] || '';
            const remaining = Math.max(budget - paidAmount, 0);
            const paid = budget > 0 && remaining < 0.005;
            const partial = paidAmount > 0 && !paid;
            let status;
            if (!budget && !dueDay) status = { label: 'Not configured', tone: 'neutral' };
            else if (!budget) status = { label: 'Set amount in Budgets', tone: 'neutral' };
            else status = dueStatus(year, month, dueDay, paid, new Date(), partial);

            return (
              <div className="bill-row" key={category.id}>
                <div className="bill-icon" aria-hidden="true">{category.icon}</div>
                <div>
                  <div className="bill-name">{category.label}</div>
                  <div className={`bill-status ${status.tone}`}>{status.label}</div>
                  {partial && <div className="muted">Paid {formatMoney(paidAmount)} of {formatMoney(budget)}</div>}
                </div>
                <div className="bill-controls">
                  <label className="due-control">
                    <span className="mini-label">Due</span>
                    <input
                      className="due-input"
                      aria-label={`${category.label} due day`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="31"
                      value={dueDay}
                      placeholder="—"
                      onChange={(event) => mutate({ type: 'SET_DUE_DAY', id: category.id, day: event.target.value })}
                    />
                  </label>
                  <div className="bill-amount money">{budget ? formatMoney(budget) : '—'}</div>
                  {budget > 0 && !paid && (
                    <button
                      className="primary-button paid-button"
                      disabled={!dueDay}
                      title={!dueDay ? 'Set a due date first' : `Record ${formatMoney(remaining)} payment`}
                      onClick={() => markBillPaid(category, remaining)}
                    >
                      {partial ? 'Pay remainder' : 'Mark paid'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {pendingBills.length > 1 && (
            <button
              className="primary-button"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => pendingBills.forEach(({ category, remaining }) => markBillPaid(category, remaining))}
            >
              Mark all {pendingBills.length} configured bills paid
            </button>
          )}
        </section>
      ) : (
        <BudgetList
          categories={categories.filter((category) => category.budgetable !== false)}
          budgets={budgets}
          priorMonthKey={priorMonthKey}
          priorBudgets={priorBudgets}
          monthKey={monthKey}
          spentByCategory={spentByCategory}
          mutate={mutate}
        />
      )}
    </>
  );
}

function BudgetList({ categories, budgets, priorMonthKey, priorBudgets, monthKey, spentByCategory, mutate }) {
  const canCopy = !Object.keys(budgets).length && Object.keys(priorBudgets).length > 0;
  return (
    <section className="card" aria-labelledby="budgets-title">
      <div className="budget-heading">
        <h2 className="section-title" id="budgets-title">Monthly budgets</h2>
        {canCopy && (
          <button className="secondary-button" onClick={() => mutate({ type: 'COPY_BUDGETS', fromMonthKey: priorMonthKey, toMonthKey: monthKey })}>
            Copy previous
          </button>
        )}
      </div>
      <p className="rule-note">Budgets are stored separately for each month so later changes do not rewrite historical months.</p>
      {categories.map((category) => {
        const budget = budgets[category.id] || 0;
        const spent = spentByCategory[category.id] || 0;
        const percentage = budget ? Math.min((spent / budget) * 100, 100) : 0;
        return (
          <div key={category.id} style={{ marginBottom: 14 }}>
            <div className="budget-row">
              <span aria-hidden="true">{category.icon}</span>
              <div className="grow ellipsis">{category.label}</div>
              <input
                className="number-input"
                aria-label={`${category.label} budget`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={budget || ''}
                placeholder="0.00"
                onChange={(event) => mutate({ type: 'SET_BUDGET', monthKey, id: category.id, value: event.target.value })}
              />
            </div>
            <div className="muted">Spent {formatMoney(spent)}{budget ? ` of ${formatMoney(budget)}` : ' · no budget set'}</div>
            {budget > 0 && <div className="bar"><div style={{ width: `${percentage}%`, background: spent > budget ? 'var(--red)' : 'var(--green)' }} /></div>}
          </div>
        );
      })}
    </section>
  );
}

function Savings({ state, annual, mutate }) {
  const goalSet = state.savingsGoal > 0;
  const remaining = goalSet ? Math.max(state.savingsGoal - state.savingsBal, 0) : 0;
  const months = goalSet && remaining > 0 && state.savingsContrib > 0 ? Math.ceil(remaining / state.savingsContrib) : null;
  const forecast = !goalSet
    ? { text: 'Set a savings goal', tone: 'neutral' }
    : remaining === 0
      ? { text: 'Goal reached', tone: 'green' }
      : months
        ? { text: `${months} months`, tone: 'green' }
        : { text: 'Set contribution', tone: 'amber' };

  return (
    <>
      <section className="card" aria-labelledby="savings-title">
        <h2 className="section-title" id="savings-title">Savings goal</h2>
        <div className="savings-grid">
          <NumberField label="Goal" value={state.savingsGoal} onChange={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsGoal', value })} />
          <NumberField label="Saved" value={state.savingsBal} onChange={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsBal', value })} />
          <NumberField label="Monthly" value={state.savingsContrib} onChange={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsContrib', value })} />
        </div>
        <div className="row"><div className="grow">Remaining</div><div className="money">{goalSet ? formatMoney(remaining) : '—'}</div></div>
        <div className="row"><div className="grow">Forecast</div><div className={`money forecast-value ${forecast.tone}`}>{forecast.text}</div></div>
      </section>

      <section className="card" aria-labelledby="surplus-title">
        <h2 className="section-title" id="surplus-title">Recorded annual surplus</h2>
        <div className={`value ${annual.available >= 0 ? 'green' : 'red'}`}>{formatMoney(annual.available)}</div>
        <div className="sub">Calculated from recorded income, refunds, fixed bills and gross spending. Transfers and card repayments marked as excluded do not change this figure.</div>
      </section>
    </>
  );
}

function NumberField({ label, value, onChange }) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={value || ''} placeholder="0.00" onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Year({ annual, year, categoryMap, onSelectMonth }) {
  const categoryTotals = {};
  annual.months.forEach((item) => item.transactions.filter((transaction) => transaction.type === 'expense').forEach((transaction) => {
    categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + transaction.amount;
  }));

  return (
    <>
      <div className="grid">
        <Stat label={`${year} income`} value={formatMoney(annual.income)} tone="green" sub={`${annual.withData.length} months with data`} />
        <Stat label={`${year} refunds`} value={formatMoney(annual.refunds)} tone="green" sub="Credits returned" />
        <Stat label={`${year} fixed bills`} value={formatMoney(annual.fixedBills)} tone="amber" sub="Recorded fixed costs" />
        <Stat label={`${year} gross spending`} value={formatMoney(annual.grossSpending)} tone="amber" sub="Before refunds" />
        <Stat label={`${year} available`} value={formatMoney(annual.available)} tone={annual.available >= 0 ? 'green' : 'red'} sub="Income + refunds − bills − spending" />
        <Stat label="Excluded movements" value={formatMoney(annual.excludedTransfers)} tone="neutral" sub="Transfers and card repayments" />
      </div>

      <section className="card" aria-labelledby="months-title">
        <h2 className="section-title" id="months-title">Month by month</h2>
        {annual.months.map((item) => (
          <button className={`year-row ${item.hasData ? '' : 'no-data'}`} key={item.key} onClick={() => onSelectMonth(item.month)}>
            <span style={{ width: 36, fontWeight: 750 }}>{SHORT_MONTHS[item.month]}</span>
            <span className="grow muted">{item.hasData ? `${formatMoney(item.income)} in · ${formatMoney(item.expenses)} out` : 'No data'}</span>
            <span className={`money ${item.hasData ? (item.available >= 0 ? 'green' : 'red') : 'neutral'}`}>{item.hasData ? formatMoney(item.available, { plus: true }) : '—'}</span>
          </button>
        ))}
      </section>

      <section className="card" aria-labelledby="year-categories-title">
        <h2 className="section-title" id="year-categories-title">Outgoings by category</h2>
        {Object.keys(categoryTotals).length ? Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([categoryId, total]) => (
          <div className="row" key={categoryId}>
            <span aria-hidden="true">{categoryMap[categoryId]?.icon || '📦'}</span>
            <div className="grow">{categoryMap[categoryId]?.label || categoryId}</div>
            <div className="money">{formatMoney(total)}</div>
          </div>
        )) : <div className="empty">No outgoing categories recorded for {year}.</div>}
      </section>
    </>
  );
}

function TransactionModal({ monthKey, categories, allCategories, state, mutate, onClose, onSave }) {
  const currentMonthKey = currentLocalPeriod().key;
  const [type, setType] = useState('expense');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [date, setDate] = useState(monthKey === currentMonthKey ? localDateKey() : `${monthKey}-01`);
  const treatment = TRANSACTION_TREATMENTS.find((item) => item.id === type);
  const needsCategory = type === 'expense' || type === 'refund';

  return (
    <SimpleModal title="Add transaction" onClose={onClose}>
      <div className="field">
        <label htmlFor="transaction-treatment">Treatment</label>
        <select id="transaction-treatment" value={type} onChange={(event) => setType(event.target.value)}>
          {TRANSACTION_TREATMENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
      <p className="rule-note">{treatment?.impact}</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="transaction-description">Description</label>
          <input id="transaction-description" value={desc} onChange={(event) => setDesc(event.target.value)} placeholder="Merchant, person or note" />
        </div>
        <div className="field">
          <label htmlFor="transaction-amount">Amount</label>
          <input id="transaction-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
        </div>
      </div>
      {needsCategory && (
        <>
          <div className="field">
            <label htmlFor="transaction-category">Category</label>
            <select id="transaction-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Select category</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}</option>)}
            </select>
          </div>
          <button
            type="button"
            className="secondary-button category-manager-toggle"
            aria-expanded={showCategoryManager}
            onClick={() => setShowCategoryManager((open) => !open)}
          >
            {showCategoryManager ? 'Close category settings' : '+ Add or manage categories'}
          </button>
          {showCategoryManager && (
            <CategoryManager
              categories={allCategories}
              state={state}
              mutate={mutate}
              onCategoryCreated={(categoryId) => {
                setCategory(categoryId);
                setShowCategoryManager(false);
              }}
            />
          )}
        </>
      )}
      <div className="field">
        <label htmlFor="transaction-date">Date</label>
        <input id="transaction-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <div className="actions">
        <button className="secondary-button" onClick={onClose}>Cancel</button>
        <button className="primary-button" onClick={() => onSave({ type, desc, amount, category, date })}>Save</button>
      </div>
    </SimpleModal>
  );
}

function IncomeModal({ sources, onClose, onSave }) {
  const [rows, setRows] = useState(sources.length ? sources.map((source) => ({ ...source })) : [{ id: createId('income'), label: '', amount: '' }]);
  const addRow = () => setRows([...rows, { id: createId('income'), label: '', amount: '' }]);

  return (
    <SimpleModal title="Monthly income" onClose={onClose}>
      <p className="rule-note">Enter each source separately, including one-off rewards or sales. Refunds belong in Transactions, not income.</p>
      {rows.map((row, index) => (
        <div className="form-grid" key={row.id}>
          <div className="field">
            <label htmlFor={`income-label-${row.id}`}>Source</label>
            <input id={`income-label-${row.id}`} value={row.label} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="Salary, Child Benefit…" />
          </div>
          <div className="field">
            <label htmlFor={`income-amount-${row.id}`}>Amount</label>
            <input id={`income-amount-${row.id}`} inputMode="decimal" value={row.amount} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} placeholder="0.00" />
          </div>
          <button className="danger-button" style={{ marginBottom: 10 }} onClick={() => setRows(rows.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
        </div>
      ))}
      <button className="secondary-button" style={{ width: '100%', marginBottom: 12 }} onClick={addRow}>+ Add income source</button>
      <div className="actions">
        <button className="secondary-button" onClick={onClose}>Cancel</button>
        <button
          className="primary-button"
          onClick={() => onSave(rows.flatMap((row) => {
            const label = row.label.trim();
            const amount = positiveNumber(row.amount);
            return label && amount ? [{ id: row.id || createId('income'), label, amount }] : [];
          }))}
        >
          Save month
        </button>
      </div>
    </SimpleModal>
  );
}

const CATEGORY_ICON_OPTIONS = ['🏷️', '🛒', '🍽️', '🚗', '🏠', '💡', '📱', '🎁', '❤️', '✈️', '👶', '🐾', '🎓', '🧾', '💳'];

function CategoryManager({ categories, state, mutate, onCategoryCreated }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [categoryType, setCategoryType] = useState('spending');

  const addCategory = () => {
    const label = name.trim();
    if (!label) return;
    const id = createId('category');
    const bill = categoryType === 'fixed';
    mutate({
      type: 'ADD_CAT',
      cat: {
        id,
        label: label.slice(0, 80),
        icon,
        group: bill ? 'Bills' : 'Other',
        bill,
        budgetable: true,
        fixed: false,
      },
    });
    setName('');
    setIcon('🏷️');
    setCategoryType('spending');
    onCategoryCreated?.(id);
  };

  return (
    <section className="category-manager-panel" aria-labelledby="category-manager-title">
      <h3 id="category-manager-title">Category settings</h3>
      <p className="rule-note">New categories default to everyday spending. Choose fixed monthly bill only for a regular committed cost that belongs in Bills.</p>

      <div className="field">
        <label htmlFor="new-category-name">Category name</label>
        <input id="new-category-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="For example: Childcare" />
      </div>

      <fieldset className="category-type-picker">
        <legend>Category type</legend>
        <label className={categoryType === 'spending' ? 'category-type-option selected' : 'category-type-option'}>
          <input type="radio" name="category-type" value="spending" checked={categoryType === 'spending'} onChange={() => setCategoryType('spending')} />
          <span><strong>Everyday spending</strong><small>Counts as normal gross spending.</small></span>
        </label>
        <label className={categoryType === 'fixed' ? 'category-type-option selected' : 'category-type-option'}>
          <input type="radio" name="category-type" value="fixed" checked={categoryType === 'fixed'} onChange={() => setCategoryType('fixed')} />
          <span><strong>Fixed monthly bill</strong><small>Appears in Bills and can have a due date.</small></span>
        </label>
      </fieldset>

      <fieldset className="icon-picker">
        <legend>Choose an icon</legend>
        <div className="icon-grid">
          {CATEGORY_ICON_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={icon === option ? 'icon-choice selected' : 'icon-choice'}
              aria-label={`Use ${option} icon`}
              aria-pressed={icon === option}
              onClick={() => setIcon(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className="primary-button" style={{ width: '100%' }} disabled={!name.trim()} onClick={addCategory}>Add category</button>

      <details className="category-list">
        <summary>Manage existing categories</summary>
        <div className="category-list-body">
          {categories.map((category) => {
            const custom = !category.fixed;
            const inUse = categoryInUse(state, category.id);
            return (
              <div className="row" key={category.id}>
                <span aria-hidden="true">{category.icon}</span>
                <div className="grow">
                  <div>{category.label}</div>
                  <div className="muted">{category.bill ? 'Fixed monthly bill' : 'Everyday spending'}</div>
                </div>
                <button type="button" className="secondary-button" onClick={() => mutate({ type: 'TOGGLE_HIDE', id: category.id })}>{state.hiddenCats.includes(category.id) ? 'Show' : 'Hide'}</button>
                {custom && (
                  <button
                    type="button"
                    className="danger-button"
                    disabled={inUse}
                    title={inUse ? 'This category is used by transactions' : 'Delete category'}
                    onClick={() => !inUse && mutate({ type: 'REMOVE_CAT', id: category.id })}
                  >
                    {inUse ? 'In use' : 'Delete'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}

function SimpleModal({ title, onClose, children }) {
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
      <div className="modal-inner">
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
