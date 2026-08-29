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
  isLikelyDuplicateIncome,
  isLikelyDuplicateTransaction,
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
  clearRollbackState,
  createBackupText,
  getBrowserStorage,
  hasRollbackState,
  loadRollbackState,
  loadState,
  mergeImportedMonths,
  parseBackupPackage,
  saveRollbackState,
  saveState,
} from './storage.js';
import './styles.css';

const browserStorage = getBrowserStorage();
const initialLoad = loadState(browserStorage, new Date());
const initialPeriod = currentLocalPeriod();
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const ICON_OPTIONS = ['🏷️','🏠','⚡','💧','🌐','📞','👨‍👦','📱','🏦','🛒','🛍️','🍽️','🚗','🎁','❤️','✈️','👶','🐾','🎓','🧾','💳'];
const CONFIRMATION_LABELS = {
  date: 'Exact date',
  paidBy: 'Paid By',
  receivedBy: 'Received By',
  account: 'Account',
  other: 'Supporting evidence',
};

function App() {
  const [state, dispatch] = useReducer(appReducer, initialLoad.state);
  const [period, setPeriod] = useState(initialPeriod);
  const [view, setView] = useState('Overview');
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(initialLoad.warning);
  const [saveEnabled, setSaveEnabled] = useState(!initialLoad.warning);
  const [recoveryRequired, setRecoveryRequired] = useState(Boolean(initialLoad.recoveryRequired));
  const [rollbackAvailable, setRollbackAvailable] = useState(hasRollbackState(browserStorage));
  const [unlockedMonths, setUnlockedMonths] = useState(() => new Set());
  const followCurrentPeriodRef = useRef(true);
  const fileRef = useRef(null);

  const mutate = (action) => {
    if (recoveryRequired) {
      setMessage('Editing is locked because the saved browser data could not be read. Import a valid backup or erase the damaged local copy in Settings first.');
      return false;
    }
    setSaveEnabled(true);
    dispatch({ ...action, auditAt: action.auditAt || new Date().toISOString() });
    return true;
  };

  useEffect(() => {
    if (!saveEnabled || recoveryRequired) return;
    const result = saveState(browserStorage, state);
    if (!result.ok) setMessage(result.error);
  }, [state, saveEnabled, recoveryRequired]);

  useEffect(() => {
    let timerId;
    const syncCurrentPeriod = () => {
      if (!followCurrentPeriodRef.current) return;
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
  const monthUnlocked = unlockedMonths.has(monthKey);
  const canEditMonth = !recoveryRequired && (!summary.isComplete || monthUnlocked);

  const setMonthValue = (value, { followCurrent = false } = {}) => {
    if (!isValidMonthKey(value)) return;
    followCurrentPeriodRef.current = followCurrent;
    const [year, month] = value.split('-').map(Number);
    setPeriod({ year, month: month - 1, key: value });
  };

  const isMonthLocked = (key) => state.monthMetaByMonth?.[key]?.status === 'complete' && !unlockedMonths.has(key);

  const unlockMonth = () => {
    if (!summary.isComplete) return;
    if (!globalThis.confirm(`Unlock ${MONTHS[period.month]} ${period.year} for corrections? Every change will be recorded in Penny Change History.`)) return;
    setUnlockedMonths((current) => new Set([...current, monthKey]));
    setMessage(`${MONTHS[period.month]} ${period.year} is unlocked for this session. Corrections will be recorded in Change History.`);
  };

  const openRecord = (config) => {
    if (!canEditMonth) {
      setMessage(summary.isComplete ? 'This completed month is locked. Unlock corrections from the Overview first.' : 'Editing is currently locked.');
      return;
    }
    setModal({ kind: 'record', ...config });
  };

  const saveTransactionRecord = ({ record, originalMonthKey }) => {
    const transaction = normaliseTransaction(record, state.customCats);
    if (!transaction) {
      setMessage('Enter a valid amount, description and date evidence before saving.');
      return false;
    }
    const targetMonthKey = transaction.date.slice(0, 7);
    if (isMonthLocked(targetMonthKey) || (originalMonthKey && isMonthLocked(originalMonthKey))) {
      setMessage('The target or source month is a locked completed month. Unlock that month before making the correction.');
      return false;
    }
    const targetRows = state.txnsByMonth[targetMonthKey] || [];
    const duplicate = targetRows.find((existing) => isLikelyDuplicateTransaction(existing, transaction));
    if (duplicate && !globalThis.confirm(`Possible duplicate: “${transaction.desc}” for ${formatMoney(transaction.amount)} already exists on that date. Save this second record anyway?`)) {
      setMessage('Duplicate save cancelled. Existing record was left unchanged.');
      return false;
    }

    if (originalMonthKey && originalMonthKey !== targetMonthKey) {
      mutate({ type: 'DELETE_TXN', monthKey: originalMonthKey, id: transaction.id, auditLabel: `Move ${transaction.desc} out of ${originalMonthKey}` });
      mutate({ type: 'ADD_TXN', monthKey: targetMonthKey, txn: transaction, auditLabel: `Move ${transaction.desc} into ${targetMonthKey}` });
    } else if (originalMonthKey) {
      mutate({ type: 'UPDATE_TXN', monthKey: targetMonthKey, txn: transaction });
    } else {
      mutate({ type: 'ADD_TXN', monthKey: targetMonthKey, txn: transaction });
    }
    setModal(null);
    if (transaction.needsConfirmation) {
      setMessage(`Saved with ${confirmationSummary(transaction.confirmationIssues)} still needing confirmation.`);
    } else if (targetMonthKey !== monthKey) {
      setMessage(`Saved to ${MONTHS[Number(targetMonthKey.slice(5, 7)) - 1]} ${targetMonthKey.slice(0, 4)}.`);
    }
    return true;
  };

  const saveIncomeRecord = ({ record, originalMonthKey }) => {
    const targetMonthKey = record.date?.slice(0, 7) || monthKey;
    const income = normaliseIncomeRecord(record, targetMonthKey);
    if (!income) {
      setMessage('Enter a valid income amount, description and date evidence before saving.');
      return false;
    }
    if (isMonthLocked(targetMonthKey) || (originalMonthKey && isMonthLocked(originalMonthKey))) {
      setMessage('The target or source month is a locked completed month. Unlock that month before making the correction.');
      return false;
    }
    const targetRows = state.incomeByMonth[targetMonthKey] || [];
    const duplicate = targetRows.find((existing) => isLikelyDuplicateIncome(existing, income));
    if (duplicate && !globalThis.confirm(`Possible duplicate: “${income.description}” for ${formatMoney(income.amount)} already exists on that date. Save this second record anyway?`)) {
      setMessage('Duplicate save cancelled. Existing record was left unchanged.');
      return false;
    }

    if (originalMonthKey && originalMonthKey !== targetMonthKey) {
      mutate({ type: 'DELETE_INCOME', monthKey: originalMonthKey, id: income.id, auditLabel: `Move ${income.description} out of ${originalMonthKey}` });
      mutate({ type: 'ADD_INCOME', monthKey: targetMonthKey, record: income, auditLabel: `Move ${income.description} into ${targetMonthKey}` });
    } else if (originalMonthKey) {
      mutate({ type: 'UPDATE_INCOME', monthKey: targetMonthKey, record: income });
    } else {
      mutate({ type: 'ADD_INCOME', monthKey: targetMonthKey, record: income });
    }
    setModal(null);
    if (income.needsConfirmation) {
      setMessage(`Saved with ${confirmationSummary(income.confirmationIssues)} still needing confirmation.`);
    } else if (targetMonthKey !== monthKey) {
      setMessage(`Income saved to ${MONTHS[Number(targetMonthKey.slice(5, 7)) - 1]} ${targetMonthKey.slice(0, 4)}.`);
    }
    return true;
  };

  const togglePaid = (transaction) => {
    if (!canEditMonth) {
      setMessage('This month is locked. Unlock corrections before changing payment status.');
      return;
    }
    mutate({ type: 'TOGGLE_PAID', monthKey, id: transaction.id });
  };

  const deleteTransaction = (transaction) => {
    if (!canEditMonth) {
      setMessage('This month is locked. Unlock corrections before deleting a record.');
      return;
    }
    if (!globalThis.confirm(`Delete “${transaction.desc}” for ${formatMoney(transaction.amount)}? The deleted record will remain in Change History.`)) return;
    mutate({ type: 'DELETE_TXN', monthKey: transaction.date.slice(0, 7), id: transaction.id });
  };

  const deleteIncome = (record) => {
    if (!canEditMonth) {
      setMessage('This month is locked. Unlock corrections before deleting a record.');
      return;
    }
    if (!globalThis.confirm(`Delete “${record.description}” for ${formatMoney(record.amount)}? The deleted record will remain in Change History.`)) return;
    mutate({ type: 'DELETE_INCOME', monthKey: record.date.slice(0, 7), id: record.id });
  };

  const exportBackup = () => {
    if (recoveryRequired) {
      setMessage('Normal backup export is disabled while storage recovery is required because the in-memory fallback is not the unreadable saved data. Import a valid backup or erase the damaged local copy first.');
      return;
    }
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
      const createRollbackAfterApproval = () => {
        if (recoveryRequired) return true;
        const rollbackResult = saveRollbackState(browserStorage, state);
        if (!rollbackResult.ok) {
          setMessage(`${rollbackResult.error} Export a manual backup before importing.`);
          return false;
        }
        setRollbackAvailable(true);
        return true;
      };

      if (backupPackage.importMode === 'merge_months') {
        const monthLabels = backupPackage.mergeMonths.map((key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`);
        const label = monthLabels.join(', ');
        if (!globalThis.confirm(`Merge ${label} into Penny? Existing records for the imported month will be replaced, but all other months will be preserved. Penny will create an automatic pre-import recovery copy after you approve.`)) return;
        if (!createRollbackAfterApproval()) return;
        const restored = mergeImportedMonths(state, backupPackage.state, backupPackage.mergeMonths);
        setSaveEnabled(true);
        setRecoveryRequired(false);
        dispatch({
          type: 'RESTORE',
          state: restored,
          auditAt: new Date().toISOString(),
          auditEvent: { action: 'import', entityType: 'month_merge', label: `Merged ${label}` },
        });
        if (backupPackage.mergeMonths.length === 1) setMonthValue(backupPackage.mergeMonths[0], { followCurrent: false });
        setModal(null);
        setMessage(`${label} merged successfully. Other months were preserved.`);
        return;
      }

      if (!globalThis.confirm('Replace the current Penny data with this backup? Penny will create an automatic pre-import recovery copy after you approve.')) return;
      if (!createRollbackAfterApproval()) return;
      setSaveEnabled(true);
      setRecoveryRequired(false);
      dispatch({
        type: 'RESTORE',
        state: backupPackage.state,
        auditAt: new Date().toISOString(),
        auditEvent: { action: 'import', entityType: 'full_restore', label: 'Replaced Penny data from backup' },
      });
      setModal(null);
      setMessage('Backup imported successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That backup could not be imported.');
    }
  };

  const restorePreviousImport = () => {
    try {
      const restored = loadRollbackState(browserStorage);
      if (!globalThis.confirm('Restore Penny to the automatic copy created immediately before the last import?')) return;
      setSaveEnabled(true);
      setRecoveryRequired(false);
      dispatch({
        type: 'RESTORE',
        state: restored,
        auditAt: new Date().toISOString(),
        auditEvent: { action: 'restore', entityType: 'automatic_recovery', label: 'Restored pre-import recovery copy' },
      });
      clearRollbackState(browserStorage);
      setRollbackAvailable(false);
      setModal(null);
      setMessage('Penny was restored to the state immediately before the last import.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The automatic recovery copy could not be restored.');
    }
  };

  const erasePennyData = () => {
    if (!globalThis.confirm('Erase all data stored by Penny on this device? This cannot be undone without a separate exported backup.')) return;
    const result = clearPennyState(browserStorage);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setSaveEnabled(true);
    setRecoveryRequired(false);
    setRollbackAvailable(false);
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
              onChange={(event) => setMonthValue(event.target.value, { followCurrent: false })}
            />
          </div>
          <button className="icon-button" aria-label="Settings and backup" onClick={() => setModal({ kind: 'settings' })}>⚙</button>
          <button
            className="add-button"
            disabled={!canEditMonth}
            title={!canEditMonth ? 'Unlock this completed month before adding records' : 'Add record'}
            onClick={() => openRecord({ mode: 'expense' })}
          >+ Add</button>
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
            canEditMonth={canEditMonth}
            onUnlockMonth={unlockMonth}
            onAddIncome={() => openRecord({ mode: 'income' })}
            onAddExpense={() => openRecord({ mode: 'expense' })}
          />
        )}

        {view === 'Transactions' && (
          <Transactions
            summary={summary}
            categoryMap={categoryMap}
            peopleMap={peopleMap}
            accountMap={accountMap}
            canEdit={canEditMonth}
            onTogglePaid={togglePaid}
            onEditTransaction={(transaction) => openRecord({ mode: transaction.type === 'expense' ? 'expense' : 'movement', transaction })}
            onEditIncome={(record) => openRecord({ mode: 'income', income: record })}
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
            canEdit={canEditMonth}
            onTogglePaid={togglePaid}
            onEdit={(transaction) => openRecord({ mode: 'expense', transaction })}
            onAdd={() => openRecord({ mode: 'expense', presetClass: 'fixed' })}
          />
        )}

        {view === 'Savings' && (
          <Savings
            state={state}
            summary={summary}
            monthKey={monthKey}
            month={period.month}
            year={period.year}
            canEdit={canEditMonth}
            mutate={mutate}
          />
        )}

        {view === 'Year' && (
          <Year
            annual={annual}
            year={period.year}
            categoryMap={categoryMap}
            onSelectMonth={(month) => {
              followCurrentPeriodRef.current = false;
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
          recoveryRequired={recoveryRequired}
          rollbackAvailable={rollbackAvailable}
          mutate={mutate}
          fileRef={fileRef}
          onImport={importBackup}
          onExport={exportBackup}
          onRestorePreviousImport={restorePreviousImport}
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

function Stat({ label, value, tone = 'neutral', sub, onClick, variant = 'standard' }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className={`value ${tone}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </>
  );
  const className = `card stat stat-${variant}${onClick ? ' stat-button' : ''}`;
  return onClick ? (
    <button className={className} onClick={onClick} aria-label={`${label}: ${value}. ${sub || ''}`}>{body}</button>
  ) : <div className={className}>{body}</div>;
}

function Overview({ summary, month, year, categoryMap, peopleMap, accountMap, canEditMonth, onUnlockMonth, onAddIncome, onAddExpense }) {
  const categoryTotals = {};
  summary.expenseTransactions.forEach((transaction) => {
    categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + transaction.amount;
  });
  const incomeTotals = {};
  summary.incomeRecords.forEach((record) => {
    const key = `${record.incomeType}::${record.receivedBy}::${record.receivedByLabel || ''}`;
    incomeTotals[key] = (incomeTotals[key] || 0) + record.amount;
  });

  return (
    <>
      {summary.isComplete && !canEditMonth && (
        <div className="locked-banner" role="note">
          <div>
            <strong>Completed month — locked</strong>
            <span>Historical figures are protected from accidental editing.</span>
          </div>
          <button className="secondary-button" onClick={onUnlockMonth}>Unlock corrections</button>
        </div>
      )}

      {!summary.isComplete && summary.hasData && (
        <div className="status-banner" role="note">In progress — this month is planning data, not final mortgage evidence until it is completed and reconciled.</div>
      )}

      {summary.incompleteRecords > 0 && (
        <div className="audit-warning" role="note">
          <strong>{summary.incompleteRecords} record{summary.incompleteRecords === 1 ? '' : 's'} need confirmation.</strong>
          <span>Unconfirmed dates, payer/receiver or accounts remain visible and prevent final evidence status.</span>
        </div>
      )}

      {summary.isComplete && !summary.startingSavingsConfirmed && (
        <div className="audit-warning" role="alert">
          <strong>Starting savings needs confirmation.</strong>
          <span>This completed month cannot be reconciled or marked Ready until an explicit starting-savings figure is supplied. Penny will not treat a missing value as zero.</span>
        </div>
      )}

      {summary.reconciliationProblem && (
        <div className="audit-warning" role="alert">
          <strong>Historical reconciliation needs review.</strong>
          <span>The recorded closing savings or payment status does not reconcile cleanly with the completed month.</span>
        </div>
      )}

      <div className="hero-grid">
        <Stat
          variant="hero"
          label={summary.isComplete ? 'Closing Savings' : 'Savings Snapshot'}
          value={formatMoney(summary.currentSavings)}
          tone="accent"
          sub={summary.hasSavingsSnapshot ? `${MONTHS[month]} ${year}` : 'No savings snapshot recorded'}
        />
        <Stat
          variant="hero"
          label={summary.isComplete ? 'Reconciliation Variance' : 'Projected End'}
          value={summary.isComplete && !summary.startingSavingsConfirmed ? 'TBC' : formatMoney(summary.isComplete ? summary.closingVariance : summary.projectedEndSavings)}
          tone={summary.isComplete ? (!summary.startingSavingsConfirmed ? 'amber' : Math.abs(summary.closingVariance || 0) < 0.005 ? 'green' : 'red') : (summary.projectedEndSavings >= 0 ? 'green' : 'red')}
          sub={summary.isComplete ? (summary.startingSavingsConfirmed ? 'Expected vs recorded closing savings' : 'Starting savings not confirmed') : 'Savings snapshot + net saving'}
        />
      </div>

      <div className="metric-grid">
        <Stat variant="compact" label="Income" value={formatMoney(summary.income)} tone="green" sub="This month" onClick={canEditMonth ? onAddIncome : undefined} />
        <Stat variant="compact" label="Expenses" value={formatMoney(summary.expenses)} tone="amber" sub="This month" onClick={canEditMonth ? onAddExpense : undefined} />
        <Stat variant="compact" label="Net Saving" value={formatMoney(summary.savedThisMonth)} tone={summary.savedThisMonth >= 0 ? 'green' : 'red'} sub="Income − expenses" />
      </div>

      {!summary.isComplete && summary.expenseTransactions.length > 0 && (
        <section className={`card ${summary.remainingBills > 0 ? 'attention-card' : ''}`} aria-labelledby="remaining-bills-title">
          <div className="section-heading">
            <div>
              <h2 className="section-title" id="remaining-bills-title">Start-of-Month Transfer Plan</h2>
              <p className="section-note">Use this at month-end: select the month you are preparing, enter bank balances in Savings, then move only the shortfall from savings.</p>
            </div>
            <div>
              <div className={`money strong ${summary.hasUnconfirmedBankBalances ? 'amber' : summary.totalTransferNeeded > 0 ? 'amber' : 'green'}`}>{summary.hasUnconfirmedBankBalances ? 'TBC' : formatMoney(summary.totalTransferNeeded)}</div>
              <div className="mini-label right-align">Transfer needed</div>
            </div>
          </div>
          {summary.accountFundingPlan.length ? summary.accountFundingPlan.map((row) => (
            <div className="row transfer-account-row" key={row.key}>
              <div className="grow">
                <div className="row-title">{row.accountLabel || accountMap[row.account]?.label || row.account}</div>
                <div className="muted">{row.count} unpaid item{row.count === 1 ? '' : 's'} to cover from this account</div>
                <div className="funding-math">
                  <span>Planned costs: {formatMoney(row.amount)}</span>
                  <span>{row.hasCurrentBalance ? `Current bank balance: ${formatMoney(row.currentBalance)}` : 'Current bank balance: TBC'}</span>
                  <span className={row.transferNeeded > 0 ? 'amber' : 'green'}>Transfer needed: {row.hasCurrentBalance ? formatMoney(row.transferNeeded) : 'TBC'}</span>
                </div>
                <div className="transfer-breakdown">
                  {row.payers.map((payer) => (
                    <span key={`${row.key}-${payer.paidBy}`}>
                      {payer.paidByLabel || peopleMap[payer.paidBy]?.label || payer.paidBy}: {formatMoney(payer.amount)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="money">{row.hasCurrentBalance ? formatMoney(row.transferNeeded) : 'TBC'}</div>
            </div>
          )) : <div className="status-banner success" role="status">All recorded expenses are marked paid. No transfer is currently required.</div>}
        </section>
      )}

      {summary.isComplete ? (
        <section className="card" aria-labelledby="historical-reconciliation-title">
          <h2 className="section-title" id="historical-reconciliation-title">Historical Reconciliation</h2>
          <p className="section-note">Completed months reconcile once: starting savings + income − expenses = closing savings. The closing balance is never projected forward again.</p>
          {summary.startingSavingsConfirmed ? <SummaryRow label="Starting Savings" value={summary.startingSavings} /> : <EvidenceTbcRow label="Starting Savings" />}
          <SummaryRow label="Plus: Income" value={summary.income} />
          <SummaryRow label="Less: Expenses" value={-summary.expenses} />
          {summary.startingSavingsConfirmed ? <SummaryRow label="Expected Closing Savings" value={summary.expectedClosingSavings} emphasis /> : <EvidenceTbcRow label="Expected Closing Savings" emphasis />}
          <SummaryRow label="Recorded Closing Savings" value={summary.currentSavings} />
          {summary.startingSavingsConfirmed ? <SummaryRow label="Reconciliation Variance" value={summary.closingVariance} emphasis /> : <EvidenceTbcRow label="Reconciliation Variance" emphasis />}
        </section>
      ) : (
        <details className="card disclosure-card">
          <summary>Cash-flow calculation</summary>
          <div className="disclosure-body">
            <SummaryRow label="Savings Snapshot" value={summary.currentSavings} />
            <SummaryRow label="Plus: Net Saving This Month" value={summary.savedThisMonth} />
            <SummaryRow label="Projected End Savings" value={summary.projectedEndSavings} emphasis />
            <SummaryRow label="Remaining Bills (information)" value={summary.remainingBills} />
            <SummaryRow label="Free Savings After Unpaid Bills (information)" value={summary.freeSavingsAfterBills} />
          </div>
        </details>
      )}

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
            const [type, receivedBy, savedLabel] = key.split('::');
            return (
              <div className="row" key={key}>
                <div className="grow">
                  <div>{type}</div>
                  <div className="muted">{savedLabel || peopleMap[receivedBy]?.label || receivedBy}</div>
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
      <div className={`money ${value < 0 ? 'red' : ''}`}>{formatMoney(value)}</div>
    </div>
  );
}

function EvidenceTbcRow({ label, emphasis = false }) {
  return (
    <div className={`row ${emphasis ? 'summary-emphasis' : ''}`}>
      <div className="grow">{label}</div>
      <span className="status-pill warning">TBC</span>
    </div>
  );
}

function Transactions({ summary, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEditTransaction, onEditIncome, onDeleteTransaction, onDeleteIncome }) {
  const [tab, setTab] = useState('expenses');
  const [search, setSearch] = useState('');
  const [paidFilter, setPaidFilter] = useState('all');
  const text = search.toLowerCase();
  const expenses = summary.expenseTransactions.filter((transaction) => {
    const matches = `${transaction.desc} ${categoryMap[transaction.category]?.label || ''} ${transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || ''} ${transaction.accountLabel || accountMap[transaction.account]?.label || ''}`.toLowerCase().includes(text);
    const paidMatches = paidFilter === 'all' || (paidFilter === 'paid' ? transaction.paid : !transaction.paid);
    return matches && paidMatches;
  });
  const income = summary.incomeRecords.filter((record) => `${record.description} ${record.incomeType} ${record.receivedByLabel || peopleMap[record.receivedBy]?.label || ''} ${record.accountLabel || accountMap[record.account]?.label || ''}`.toLowerCase().includes(text));
  const movements = summary.transactions.filter((transaction) => transaction.type !== 'expense').filter((transaction) => `${transaction.desc} ${SPECIAL_TRANSACTION_META[transaction.type]?.label || ''}`.toLowerCase().includes(text));

  return (
    <>
      {!canEdit && summary.isComplete && <div className="status-banner">Completed month is read-only until corrections are unlocked from Overview.</div>}
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
              canEdit={canEdit}
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
                <div className="record-meta">{recordDateLabel(record)} · {record.incomeType}</div>
                <div className="record-meta">Received by {record.receivedByLabel || peopleMap[record.receivedBy]?.label || record.receivedBy} · {record.accountLabel || accountMap[record.account]?.label || record.account}</div>
                <RecordBadges record={record} />
              </div>
              <div className="record-side">
                <div className="money green">{formatMoney(record.amount)}</div>
                {canEdit && <div className="mini-actions">
                  <button className="secondary-button" onClick={() => onEditIncome(record)}>Edit</button>
                  <button className="danger-button" onClick={() => onDeleteIncome(record)}>Delete</button>
                </div>}
              </div>
            </div>
          )) : <div className="empty">No matching income.</div>}
        </section>
      )}

      {tab === 'movements' && (
        <section className="card" aria-labelledby="movements-list-title">
          <h2 className="section-title" id="movements-list-title">Excluded movements</h2>
          <p className="section-note">Internal transfers, savings transfers and card repayments stay visible for audit but do not count as expenses.</p>
          {movements.length ? movements.map((transaction) => (
            <div className="record-row" key={transaction.id}>
              <div className="record-main">
                <div className="record-title">{transaction.desc}</div>
                <div className="record-meta">{recordDateLabel(transaction)} · {SPECIAL_TRANSACTION_META[transaction.type]?.label || 'Legacy credit'}</div>
                <RecordBadges record={transaction} />
              </div>
              <div className="record-side">
                <div className="money">{formatMoney(transaction.amount)}</div>
                {canEdit && <div className="mini-actions">
                  {transaction.type !== 'refund' && <button className="secondary-button" onClick={() => onEditTransaction(transaction)}>Edit</button>}
                  <button className="danger-button" onClick={() => onDeleteTransaction(transaction)}>Delete</button>
                </div>}
              </div>
            </div>
          )) : <div className="empty">No matching transfers or repayments.</div>}
        </section>
      )}
    </>
  );
}

function ExpenseRow({ transaction, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEdit, onDelete }) {
  return (
    <div className="record-row">
      <div className="record-icon" aria-hidden="true">{categoryMap[transaction.category]?.icon || '📦'}</div>
      <div className="record-main">
        <div className="record-title">{transaction.desc}</div>
        <div className="record-meta">{recordDateLabel(transaction)} · {categoryMap[transaction.category]?.label || transaction.category} · {transaction.expenseClass === 'fixed' ? 'Fixed' : 'Variable'}</div>
        <div className="record-meta">{transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || transaction.paidBy} · {transaction.accountLabel || accountMap[transaction.account]?.label || transaction.account}</div>
        <div className="pill-line">
          <span className={`status-pill ${transaction.paid ? 'success' : 'warning'}`}>{transaction.paid ? 'Paid' : 'Unpaid'}</span>
          <RecordBadges record={transaction} compact />
        </div>
      </div>
      <div className="record-side">
        <div className="money">{formatMoney(transaction.amount)}</div>
        {canEdit && <div className="mini-actions">
          <button className="secondary-button" onClick={() => onTogglePaid(transaction)}>{transaction.paid ? 'Mark unpaid' : 'Mark paid'}</button>
          <button className="secondary-button" onClick={() => onEdit(transaction)}>Edit</button>
          <button className="danger-button" onClick={() => onDelete(transaction)}>Delete</button>
        </div>}
      </div>
    </div>
  );
}

function RecordBadges({ record, compact = false }) {
  const badges = [];
  if (record.needsConfirmation) badges.push(<span key="confirm" className="status-pill warning">{confirmationSummary(record.confirmationIssues)}</span>);
  if (record.source === 'import') badges.push(<span key="source" className="status-pill neutral">Imported</span>);
  if (!badges.length) return null;
  return compact ? badges : <div className="pill-line">{badges}</div>;
}

function Bills({ summary, categoryMap, peopleMap, accountMap, canEdit, onTogglePaid, onEdit, onAdd }) {
  const bills = summary.expenseTransactions
    .filter((transaction) => transaction.expenseClass === 'fixed')
    .sort((a, b) => Number(a.paid) - Number(b.paid) || a.date.localeCompare(b.date));
  const stillToFund = bills.filter((bill) => !bill.paid).reduce((sum, bill) => sum + bill.amount, 0);
  return (
    <>
      <div className="metric-grid two-metrics">
        <Stat variant="compact" label="Fixed Costs" value={formatMoney(summary.fixedExpenses)} tone="amber" sub="Recorded fixed expenses" />
        <Stat variant="compact" label="Still to Fund" value={formatMoney(stillToFund)} tone={stillToFund ? 'amber' : 'green'} sub="Unpaid fixed costs" />
      </div>
      <section className="card" aria-labelledby="monthly-bills-title">
        <div className="section-heading">
          <div>
            <h2 className="section-title" id="monthly-bills-title">Monthly Bills</h2>
            <p className="section-note">Responsibility, account and payment status remain visible on every fixed cost.</p>
          </div>
          {canEdit && <button className="primary-button" onClick={onAdd}>+ Add bill</button>}
        </div>
        {bills.length ? bills.map((transaction) => (
          <div className="bill-row" key={transaction.id}>
            <div className="record-icon" aria-hidden="true">{categoryMap[transaction.category]?.icon || '🧾'}</div>
            <div className="grow">
              <div className="row-title">{transaction.desc}</div>
              <div className="muted">{transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || transaction.paidBy} · {transaction.accountLabel || accountMap[transaction.account]?.label || transaction.account}</div>
              <div className="pill-line">
                <span className={`status-pill ${transaction.paid ? 'success' : 'warning'}`}>{transaction.paid ? 'Paid' : 'Unpaid'}</span>
                <RecordBadges record={transaction} compact />
              </div>
            </div>
            <div className="bill-actions">
              <div className="money">{formatMoney(transaction.amount)}</div>
              {canEdit && <>
                <button className="secondary-button" onClick={() => onTogglePaid(transaction)}>{transaction.paid ? 'Mark unpaid' : 'Mark paid'}</button>
                <button className="secondary-button" onClick={() => onEdit(transaction)}>Edit</button>
              </>}
            </div>
          </div>
        )) : <div className="empty">No fixed bills recorded for this month.</div>}
      </section>
    </>
  );
}

function Savings({ state, summary, monthKey, month, year, canEdit, mutate }) {
  const savingsAccounts = state.savingsByMonth?.[monthKey] || [];
  const bankBalances = state.bankBalancesByMonth?.[monthKey] || [];
  const setAccounts = (items, label = 'Update savings snapshot') => mutate({ type: 'SET_SAVINGS_ACCOUNTS', monthKey, items, auditLabel: label });
  const setBankBalances = (items, label = 'Update bill-paying bank balances') => mutate({ type: 'SET_BANK_BALANCES', monthKey, items, auditLabel: label });
  const addAccount = () => setAccounts([...savingsAccounts, { id: createId('saving'), label: 'New savings account', balance: 0 }], 'Add savings account');
  const removeAccount = (id) => {
    const account = savingsAccounts.find((item) => item.id === id);
    if (account?.balance && !globalThis.confirm(`Remove ${account.label} with a recorded balance of ${formatMoney(account.balance)}?`)) return;
    setAccounts(savingsAccounts.filter((item) => item.id !== id), `Remove ${account?.label || 'savings account'}`);
  };
  const updateAccount = (id, patch) => setAccounts(savingsAccounts.map((account) => account.id === id ? { ...account, ...patch } : account), 'Update savings account');
  const bankBalanceMap = Object.fromEntries(bankBalances.map((account) => [account.id, account]));
  const updateBankBalance = (account, balance) => {
    const existing = bankBalanceMap[account.id];
    const nextRow = { id: account.id, label: account.label, balance: Math.max(0, Number(balance) || 0) };
    const next = existing
      ? bankBalances.map((row) => row.id === account.id ? nextRow : row)
      : [...bankBalances, nextRow];
    setBankBalances(next, `Update ${account.label} bank balance`);
  };
  const goalRemaining = state.savingsGoal > 0 ? Math.max(state.savingsGoal - summary.currentSavings, 0) : null;
  const months = goalRemaining && state.savingsContrib > 0 ? Math.ceil(goalRemaining / state.savingsContrib) : null;

  return (
    <>
      {!canEdit && summary.isComplete && <div className="status-banner">Completed savings snapshot is locked. Unlock corrections from Overview to edit it.</div>}
      <section className="card" aria-labelledby="savings-accounts-title">
        <div className="section-heading">
          <div>
            <h2 className="section-title" id="savings-accounts-title">Savings Accounts — {MONTHS[month]} {year}</h2>
            <p className="section-note">This snapshot belongs only to the selected month. Historical snapshots are protected when the month is complete.</p>
          </div>
          {canEdit && <button className="primary-button" onClick={addAccount}>+ Account</button>}
        </div>
        {savingsAccounts.length ? savingsAccounts.map((account) => (
          <SavingsAccountEditor
            key={account.id}
            account={account}
            canEdit={canEdit}
            onCommit={(patch) => updateAccount(account.id, patch)}
            onRemove={() => removeAccount(account.id)}
          />
        )) : <div className="empty">No savings snapshot has been recorded for {MONTHS[month]} {year}.</div>}
        <div className="total-line"><span>{summary.isComplete ? 'Closing Savings' : 'Savings Snapshot'}</span><span className="money green">{formatMoney(summary.currentSavings)}</span></div>
      </section>

      {!summary.isComplete && (
        <section className="card" aria-labelledby="bank-balances-title">
          <div className="section-heading">
            <div>
              <h2 className="section-title" id="bank-balances-title">Bill-Paying Bank Balances — {MONTHS[month]} {year}</h2>
              <p className="section-note">Enter the money already sitting in each spending account before you top it up from savings. These balances only calculate the transfer shortfall.</p>
            </div>
          </div>
          {state.accounts.length ? state.accounts.map((account) => (
            <BankBalanceEditor
              key={account.id}
              account={account}
              balance={bankBalanceMap[account.id]?.balance}
              canEdit={canEdit}
              onCommit={(value) => updateBankBalance(account, value)}
            />
          )) : <div className="empty">Add bill-paying accounts in Settings before entering bank balances.</div>}
          <div className="total-line"><span>Transfer Needed</span><span className={`money ${summary.hasUnconfirmedBankBalances ? 'amber' : summary.totalTransferNeeded > 0 ? 'amber' : 'green'}`}>{summary.hasUnconfirmedBankBalances ? 'TBC' : formatMoney(summary.totalTransferNeeded)}</span></div>
        </section>
      )}

      {!summary.isComplete && (
        <section className="card" aria-labelledby="savings-goal-title">
          <h2 className="section-title" id="savings-goal-title">Savings Goal</h2>
          <div className="form-grid">
            <NumberField label="Goal" value={state.savingsGoal} onCommit={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsGoal', value })} />
            <NumberField label="Monthly Contribution" value={state.savingsContrib} onCommit={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsContrib', value })} />
          </div>
          <SummaryRow label="Remaining" value={goalRemaining ?? 0} />
          <div className="row"><div className="grow">Forecast</div><div>{state.savingsGoal ? (goalRemaining === 0 ? 'Goal reached' : months ? `${months} months` : 'Set monthly contribution') : 'Set a goal'}</div></div>
        </section>
      )}
    </>
  );
}

function BankBalanceEditor({ account, balance, canEdit, onCommit }) {
  const [draft, setDraft] = useState(balance == null ? '' : String(balance));
  useEffect(() => setDraft(balance == null ? '' : String(balance)), [balance]);
  const commit = () => {
    if (!canEdit) return;
    const next = Math.max(0, Number(draft) || 0);
    if (balance == null || next !== balance) onCommit(next);
  };
  return (
    <div className="bank-balance-row">
      <div className="grow">
        <div className="row-title">{account.label}</div>
        <div className="muted">Current balance before savings top-up</div>
      </div>
      <div className="field amount-field compact-field">
        <label htmlFor={`bank-balance-${account.id}`}>Bank balance</label>
        <input id={`bank-balance-${account.id}`} disabled={!canEdit} type="number" inputMode="decimal" min="0" step="0.01" value={draft} placeholder="TBC" onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
      </div>
    </div>
  );
}

function SavingsAccountEditor({ account, canEdit, onCommit, onRemove }) {
  const [label, setLabel] = useState(account.label);
  const [balance, setBalance] = useState(String(account.balance || ''));
  useEffect(() => {
    setLabel(account.label);
    setBalance(String(account.balance || ''));
  }, [account.label, account.balance]);
  const commit = () => {
    if (!canEdit) return;
    const nextLabel = label.trim() || account.label;
    const nextBalance = Math.max(0, Number(balance) || 0);
    if (nextLabel !== account.label || nextBalance !== account.balance) onCommit({ label: nextLabel.slice(0, 80), balance: nextBalance });
  };
  return (
    <div className="savings-account-row">
      <div className="field grow compact-field">
        <label htmlFor={`saving-label-${account.id}`}>Account</label>
        <input id={`saving-label-${account.id}`} disabled={!canEdit} value={label} onChange={(event) => setLabel(event.target.value)} onBlur={commit} />
      </div>
      <div className="field amount-field compact-field">
        <label htmlFor={`saving-balance-${account.id}`}>Balance</label>
        <input id={`saving-balance-${account.id}`} disabled={!canEdit} type="number" inputMode="decimal" min="0" step="0.01" value={balance} placeholder="0.00" onChange={(event) => setBalance(event.target.value)} onBlur={commit} />
      </div>
      {canEdit && <button className="danger-button remove-row-button" onClick={onRemove}>Remove</button>}
    </div>
  );
}

function NumberField({ label, value, onCommit }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const [draft, setDraft] = useState(String(value || ''));
  useEffect(() => setDraft(String(value || '')), [value]);
  const commit = () => {
    const next = Math.max(0, Number(draft) || 0);
    if (next !== value) onCommit(next);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={draft} placeholder="0.00" onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
    </div>
  );
}

function Year({ annual, year, categoryMap, onSelectMonth }) {
  const categoryTotals = {};
  annual.months.forEach((item) => item.expenseTransactions.forEach((transaction) => {
    categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + transaction.amount;
  }));
  const statusLabel = evidenceStatusLabel(annual.evidenceStatus);
  const statusTone = annual.evidenceStatus === 'ready' ? 'green' : annual.evidenceStatus === 'in_progress' ? 'accent' : 'amber';
  const statusSub = annual.evidenceStatus === 'ready'
    ? 'All data months completed and reconciled'
    : annual.evidenceStatus === 'in_progress'
      ? `${annual.monthsInProgress} month${annual.monthsInProgress === 1 ? '' : 's'} in progress`
      : annual.withData.length
        ? `${annual.monthsNeedingReview} completed month${annual.monthsNeedingReview === 1 ? '' : 's'} need review`
        : 'No evidence recorded';

  return (
    <>
      {annual.evidenceStatus === 'in_progress' && (
        <div className="audit-warning" role="note">
          <strong>{year} contains in-progress evidence.</strong>
          <span>{annual.monthsInProgress} month{annual.monthsInProgress === 1 ? '' : 's'} with data are not completed yet. Only completed, reconciled months can be mortgage-ready.{annual.incompleteRecords ? ` ${annual.incompleteRecords} record${annual.incompleteRecords === 1 ? '' : 's'} also need confirmation.` : ''}{annual.monthsNeedingReview ? ` ${annual.monthsNeedingReview} completed month${annual.monthsNeedingReview === 1 ? '' : 's'} also need review.` : ''}</span>
        </div>
      )}
      {annual.evidenceStatus === 'review' && annual.withData.length > 0 && (
        <div className="audit-warning" role="note">
          <strong>{year} completed evidence needs review.</strong>
          <span>{annual.monthsNeedingReview} completed month{annual.monthsNeedingReview === 1 ? '' : 's'} are not mortgage-ready.{annual.incompleteRecords ? ` ${annual.incompleteRecords} record${annual.incompleteRecords === 1 ? '' : 's'} need confirmation.` : ''}{annual.unreconciledMonths ? ` ${annual.unreconciledMonths} completed reconciliation${annual.unreconciledMonths === 1 ? '' : 's'} do not balance.` : ''}</span>
        </div>
      )}
      <div className="metric-grid year-metrics">
        <Stat variant="compact" label={`${year} Income`} value={formatMoney(annual.income)} tone="green" sub={`${annual.withData.length} months with data`} />
        <Stat variant="compact" label={`${year} Expenses`} value={formatMoney(annual.expenses)} tone="amber" sub="All recorded costs" />
        <Stat variant="compact" label={`${year} Net Saving`} value={formatMoney(annual.savedThisMonth)} tone={annual.savedThisMonth >= 0 ? 'green' : 'red'} sub="Income − expenses" />
        <Stat variant="compact" label="Evidence Status" value={statusLabel} tone={statusTone} sub={statusSub} />
      </div>
      <section className="card" aria-labelledby="months-title">
        <h2 className="section-title" id="months-title">Month by Month</h2>
        {annual.months.map((item) => (
          <button className={`year-row ${item.hasData ? '' : 'no-data'}`} key={item.key} onClick={() => onSelectMonth(item.month)}>
            <span className="month-name">{SHORT_MONTHS[item.month]}</span>
            <span className="grow muted">{item.hasData ? `${formatMoney(item.income)} in · ${formatMoney(item.expenses)} out` : 'No records'}</span>
            {item.hasData && <span className={`status-pill ${evidenceStatusTone(item.evidenceStatus)}`}>{evidenceStatusLabel(item.evidenceStatus)}</span>}
            <span className={`money ${item.savedThisMonth >= 0 ? 'green' : 'red'}`}>{item.hasData ? formatMoney(item.savedThisMonth, { plus: true }) : '—'}</span>
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
  const existing = transaction || income;
  const lockedMode = Boolean(existing);
  const existingIssues = existing?.confirmationIssues || [];
  const initialDateConfirmed = existing ? !existingIssues.includes('date') : monthKey === currentLocalPeriod().key;
  const [mode, setMode] = useState(initialMode || 'expense');
  const [description, setDescription] = useState(transaction?.desc || income?.description || '');
  const [amount, setAmount] = useState(transaction?.amount || income?.amount || '');
  const [dateConfirmed, setDateConfirmed] = useState(initialDateConfirmed);
  const [date, setDate] = useState(initialDateConfirmed ? (existing?.date || localDateKey()) : '');
  const [category, setCategory] = useState(transaction?.category || '');
  const selectedCategory = categories.find((item) => item.id === category);
  const [expenseClass, setExpenseClass] = useState(transaction?.expenseClass || presetClass || selectedCategory?.defaultClass || 'variable');
  const [paid, setPaid] = useState(transaction?.paid ?? false);
  const [paidBy, setPaidBy] = useState(transaction?.paidBy || 'unassigned');
  const [account, setAccount] = useState(transaction?.account || income?.account || 'unassigned');
  const [receivedBy, setReceivedBy] = useState(income?.receivedBy || 'unassigned');
  const [incomeType, setIncomeType] = useState(income?.incomeType || '');
  const [movementType, setMovementType] = useState(transaction?.type && transaction.type !== 'expense' ? transaction.type : 'internal_transfer');
  const [formError, setFormError] = useState('');

  const save = () => {
    setFormError('');
    if (!description.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (!(Number(amount) > 0)) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    if (dateConfirmed && !date) {
      setFormError('Enter the confirmed date, or mark the exact date as not confirmed.');
      return;
    }
    const effectiveDate = dateConfirmed ? date : `${monthKey}-01`;

    if (mode === 'income') {
      if (!incomeType.trim()) {
        setFormError('Income type is required.');
        return;
      }
      const issues = buildConfirmationIssues(existingIssues, {
        dateConfirmed,
        receivedBy,
        account,
        kind: 'income',
      });
      onSaveIncome({
        originalMonthKey: income?.date?.slice(0, 7),
        record: {
          id: income?.id || createId('income'),
          date: effectiveDate,
          amount,
          description,
          incomeType,
          receivedBy,
          account,
          receivedByLabel: preservedOrSelectedLabel(income?.receivedBy, income?.receivedByLabel, receivedBy, peopleOptions),
          accountLabel: preservedOrSelectedLabel(income?.account, income?.accountLabel, account, accountOptions),
          confirmationIssues: issues,
          dateConfirmed,
          needsConfirmation: issues.length > 0,
          source: income?.source || 'manual',
        },
      });
      return;
    }

    const type = mode === 'movement' ? movementType : 'expense';
    if (type === 'expense' && !category) {
      setFormError('Select an expense category.');
      return;
    }
    const issues = buildConfirmationIssues(existingIssues, {
      dateConfirmed,
      paidBy,
      account,
      kind: type === 'expense' ? 'expense' : 'movement',
    });
    onSaveTransaction({
      originalMonthKey: transaction?.date?.slice(0, 7),
      record: {
        id: transaction?.id || createId('txn'),
        type,
        date: effectiveDate,
        amount,
        desc: description,
        category: type === 'expense' ? category : type,
        expenseClass,
        paid: type === 'expense' ? paid : true,
        paidBy: type === 'expense' ? paidBy : '',
        account,
        paidByLabel: type === 'expense' ? preservedOrSelectedLabel(transaction?.paidBy, transaction?.paidByLabel, paidBy, peopleOptions) : '',
        accountLabel: preservedOrSelectedLabel(transaction?.account, transaction?.accountLabel, account, accountOptions),
        confirmationIssues: issues,
        dateConfirmed,
        needsConfirmation: issues.length > 0,
        source: transaction?.source || 'manual',
      },
    });
  };

  return (
    <SimpleModal title={existing ? 'Edit record' : 'Add record'} onClose={onClose}>
      {!lockedMode && (
        <div className="tabs record-tabs" role="tablist" aria-label="Record type">
          <button role="tab" aria-selected={mode === 'expense'} className={mode === 'expense' ? 'active' : ''} onClick={() => setMode('expense')}>Expense</button>
          <button role="tab" aria-selected={mode === 'income'} className={mode === 'income' ? 'active' : ''} onClick={() => setMode('income')}>Income</button>
          <button role="tab" aria-selected={mode === 'movement'} className={mode === 'movement' ? 'active' : ''} onClick={() => setMode('movement')}>Transfer</button>
        </div>
      )}

      {formError && <div className="form-error" role="alert">{formError}</div>}

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
        <label htmlFor="record-date">Exact date</label>
        <input
          id="record-date"
          type="date"
          value={date}
          disabled={!dateConfirmed}
          onChange={(event) => {
            setDate(event.target.value);
            if (event.target.value) setDateConfirmed(true);
          }}
        />
      </div>
      <label className="evidence-toggle">
        <input
          type="checkbox"
          checked={!dateConfirmed}
          onChange={(event) => {
            const unknown = event.target.checked;
            setDateConfirmed(!unknown);
            if (unknown) setDate('');
          }}
        />
        <span><strong>Exact date not confirmed</strong><small>Penny will show “Date TBC” and use the 1st internally only to keep the record in the selected month.</small></span>
      </label>

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
              <span><strong>Paid</strong><small>Already paid</small></span>
            </label>
            <label className={!paid ? 'choice-card selected' : 'choice-card'}>
              <input type="radio" name="payment-status" checked={!paid} onChange={() => setPaid(false)} />
              <span><strong>Unpaid</strong><small>Included in Remaining Bills / Transfer Plan</small></span>
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

function SettingsModal({ state, allCategories, recoveryRequired, rollbackAvailable, mutate, fileRef, onImport, onExport, onRestorePreviousImport, onErase, onClose }) {
  return (
    <SimpleModal title="Settings" onClose={onClose} wide>
      {recoveryRequired && (
        <div className="audit-warning" role="alert">
          <strong>Storage recovery required.</strong>
          <span>Normal editing and normal backup export are locked so unreadable saved data cannot be overwritten or confused with the blank recovery fallback. Import a valid backup or erase the damaged local copy.</span>
        </div>
      )}
      {!recoveryRequired && (
        <>
          <section className="settings-section">
            <h3>Household People</h3>
            <p className="section-note">Used for Paid By and Received By. Renaming a person changes future choices; historical records keep the label that was saved with the record.</p>
            <ReferenceEditor field="people" items={state.people} state={state} mutate={mutate} placeholder="Person name" />
          </section>
          <section className="settings-section">
            <h3>Accounts</h3>
            <p className="section-note">Renaming an account changes future choices; historical records keep their saved account label.</p>
            <ReferenceEditor field="accounts" items={state.accounts} state={state} mutate={mutate} placeholder="Account name" />
          </section>
          <section className="settings-section">
            <CategoryManager categories={allCategories} state={state} mutate={mutate} />
          </section>
          <section className="settings-section">
            <ChangeHistory auditLog={state.auditLog || []} />
          </section>
        </>
      )}
      <section className="settings-section">
        <h3>Backup and Recovery</h3>
        <p className="section-note">{recoveryRequired ? 'Recovery mode: import a known-good Penny backup or erase the damaged local copy. The blank in-memory fallback is deliberately not exportable.' : 'Penny is stored on this device. Every import creates an automatic pre-import recovery copy when browser storage is healthy.'}</p>
        <div className="actions stacked-actions">
          <button className="primary-button" disabled={recoveryRequired} title={recoveryRequired ? 'Unavailable during storage recovery' : 'Export Penny backup'} onClick={onExport}>Export backup</button>
          <button className="secondary-button" onClick={() => fileRef.current?.click()}>Import backup</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        {rollbackAvailable && <button className="secondary-button full-width recovery-button" onClick={onRestorePreviousImport}>Restore state before last import</button>}
        <button className="danger-button full-width" onClick={onErase}>Erase Penny data on this device</button>
      </section>
    </SimpleModal>
  );
}

function ChangeHistory({ auditLog }) {
  const visible = auditLog.slice(0, 100);
  return (
    <>
      <h3>Change History</h3>
      <p className="section-note">Penny keeps up to 1,000 local change entries. Deleted financial records retain their before-state here for audit traceability.</p>
      {visible.length ? (
        <details className="category-list">
          <summary>Show recent changes ({auditLog.length})</summary>
          <div className="history-list">
            {visible.map((entry) => (
              <details className="history-row" key={entry.id}>
                <summary className="history-summary">
                  <div className="grow">
                    <div className="row-title">{auditActionLabel(entry.action)} · {entry.label}</div>
                    <div className="muted">{formatAuditTime(entry.at)}{entry.monthKey ? ` · ${entry.monthKey}` : ''}</div>
                  </div>
                  <span className="status-pill neutral">{entry.entityType}</span>
                </summary>
                <div className="history-details">
                  <AuditSnapshot title="Before" value={entry.before} />
                  <AuditSnapshot title="After" value={entry.after} />
                </div>
              </details>
            ))}
          </div>
        </details>
      ) : <div className="empty">No changes have been recorded yet.</div>}
    </>
  );
}

function AuditSnapshot({ title, value }) {
  if (!value) return <div className="history-snapshot"><div className="mini-label">{title}</div><div className="muted">Not applicable</div></div>;
  return (
    <div className="history-snapshot">
      <div className="mini-label">{title}</div>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function ReferenceEditor({ field, items, state, mutate, placeholder }) {
  const [newLabel, setNewLabel] = useState('');
  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    mutate({ type: 'SET_REFERENCE_LIST', field, items: [...items, { id: createId(field === 'people' ? 'person' : 'account'), label: label.slice(0, 80) }], auditLabel: `Add ${label}` });
    setNewLabel('');
  };
  const update = (id, label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const before = items.find((item) => item.id === id);
    if (!before || before.label === trimmed) return;
    mutate({ type: 'SET_REFERENCE_LIST', field, items: items.map((item) => item.id === id ? { ...item, label: trimmed.slice(0, 80) } : item), auditLabel: `Rename ${before.label} to ${trimmed}` });
  };
  const remove = (id) => {
    if (referenceInUse(state, field, id)) return;
    const before = items.find((item) => item.id === id);
    mutate({ type: 'SET_REFERENCE_LIST', field, items: items.filter((item) => item.id !== id), auditLabel: `Remove ${before?.label || field}` });
  };
  return (
    <>
      {items.map((item) => (
        <ReferenceRowEditor
          key={item.id}
          item={item}
          inUse={referenceInUse(state, field, item.id)}
          onCommit={(label) => update(item.id, label)}
          onRemove={() => remove(item.id)}
        />
      ))}
      <div className="settings-row">
        <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
        <button className="primary-button" disabled={!newLabel.trim()} onClick={add}>Add</button>
      </div>
    </>
  );
}

function ReferenceRowEditor({ item, inUse, onCommit, onRemove }) {
  const [draft, setDraft] = useState(item.label);
  useEffect(() => setDraft(item.label), [item.label]);
  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(item.label);
      return;
    }
    onCommit(trimmed);
  };
  return (
    <div className="settings-row">
      <input aria-label="Reference name" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
      <button className="danger-button" disabled={inUse} title={inUse ? 'Used by existing records' : 'Remove'} onClick={onRemove}>{inUse ? 'In use' : 'Remove'}</button>
    </div>
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
      <p className="section-note">Category type is a default only. The fixed/variable classification remains stored on each expense record.</p>
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
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [onClose]);
  return (
    <div className="modal" role="presentation">
      <div ref={dialogRef} className={`modal-inner ${wide ? 'wide-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 className="section-title" id={titleId}>{title}</h2>
          <button ref={closeRef} className="secondary-button" onClick={onClose}>Done</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function recordDateLabel(record) {
  if (record.confirmationIssues?.includes('date') || record.dateConfirmed === false) {
    const monthKey = String(record.date || '').slice(0, 7);
    if (isValidMonthKey(monthKey)) {
      const [year, month] = monthKey.split('-').map(Number);
      return `Date TBC · ${MONTHS[month - 1]} ${year}`;
    }
    return 'Date TBC';
  }
  return formatDate(record.date);
}

function confirmationSummary(issues = []) {
  if (!issues?.length) return 'Evidence confirmed';
  const labels = [...new Set(issues)].map((issue) => CONFIRMATION_LABELS[issue] || issue);
  return labels.length === 1 ? `${labels[0]} TBC` : `${labels.length} fields TBC`;
}

function buildConfirmationIssues(existingIssues, { dateConfirmed, paidBy, receivedBy, account, kind }) {
  const issues = new Set((existingIssues || []).filter((issue) => issue === 'other'));
  if (!dateConfirmed) issues.add('date');
  if (kind === 'expense' && paidBy === 'unassigned') issues.add('paidBy');
  if (kind === 'income' && receivedBy === 'unassigned') issues.add('receivedBy');
  if ((kind === 'expense' || kind === 'income' || kind === 'movement') && account === 'unassigned') issues.add('account');
  return [...issues];
}

function preservedOrSelectedLabel(existingId, existingLabel, nextId, options) {
  if (existingId && existingId === nextId && existingLabel) return existingLabel;
  return options.find((item) => item.id === nextId)?.label || nextId || '';
}

function evidenceStatusLabel(status) {
  if (status === 'ready') return 'Ready';
  if (status === 'in_progress') return 'In progress';
  if (status === 'review') return 'Review';
  return 'No data';
}

function evidenceStatusTone(status) {
  if (status === 'ready') return 'success';
  if (status === 'review') return 'warning';
  return 'neutral';
}

function auditActionLabel(action) {
  const labels = {
    add: 'Added',
    update: 'Updated',
    delete: 'Deleted',
    mark_paid: 'Marked paid',
    mark_unpaid: 'Marked unpaid',
    import: 'Imported',
    restore: 'Restored',
    hide: 'Hidden',
    show: 'Shown',
  };
  return labels[action] || action;
}

function formatAuditTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default App;
