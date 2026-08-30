from pathlib import Path
import json
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


def regex_once(path, pattern, repl):
    p = Path(path)
    text = p.read_text()
    updated, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, found {count}: {pattern[:120]!r}")
    p.write_text(updated)


# Reducer-level atomic copy and duplicate protection.
replace_once(
    'src/state.js',
    "} from './finance.js';\n",
    "} from './finance.js';\nimport { recurringBillKey } from './month-setup.js';\n",
)
insert_before = """    case 'ADD_INCOME': {
"""
copy_case = """    case 'COPY_RECURRING_BILLS': {
      if (!isValidMonthKey(action.monthKey) || !Array.isArray(action.bills)) return state;
      const existingRows = state.txnsByMonth[action.monthKey] || [];
      const existingKeys = new Set(
        existingRows
          .filter((transaction) => transaction.type === 'expense' && transaction.expenseClass === 'fixed')
          .map(recurringBillKey)
          .filter(Boolean),
      );
      const copiedBills = [];
      action.bills.forEach((bill) => {
        if (!bill || bill.type !== 'expense' || bill.expenseClass !== 'fixed') return;
        const key = recurringBillKey(bill);
        if (!key || existingKeys.has(key)) return;
        existingKeys.add(key);
        copiedBills.push({ ...bill, paid: false, source: 'month_copy' });
      });
      if (!copiedBills.length) return state;
      const nextRows = sortByDate([...copiedBills, ...existingRows]);
      const next = { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: nextRows } };
      return appendAudit(next, action, {
        action: 'copy_bills',
        entityType: 'monthly_setup',
        monthKey: action.monthKey,
        label: `Copied ${copiedBills.length} recurring bill${copiedBills.length === 1 ? '' : 's'}`,
        after: {
          sourceMonthKey: isValidMonthKey(action.sourceMonthKey) ? action.sourceMonthKey : '',
          copiedBills,
        },
      });
    }
"""
replace_once('src/state.js', insert_before, copy_case + insert_before)

# App imports and monthly setup state.
replace_once(
    'src/App.jsx',
    "import { appReducer, categoryInUse, referenceInUse } from './state.js';\n",
    "import { appReducer, categoryInUse, referenceInUse } from './state.js';\nimport { buildRecurringBillCopies, recurringBillSelectionTotal, recurringBillSetup } from './month-setup.js';\n",
)
replace_once(
    'src/App.jsx',
    "  const summary = useMemo(() => monthSummary(state, monthKey), [state, monthKey]);\n",
    "  const summary = useMemo(() => monthSummary(state, monthKey), [state, monthKey]);\n  const monthSetup = useMemo(() => recurringBillSetup(state, monthKey), [state, monthKey]);\n",
)

# App-level single-screen bank balance and Start New Month handlers.
marker = """  const erasePennyData = () => {
"""
handlers = """  const updateTransferBankBalance = (accountId, balance) => {
    if (!canEditMonth) {
      setMessage('This month is locked. Unlock corrections before changing bank balances.');
      return;
    }
    const account = state.accounts.find((item) => item.id === accountId);
    if (!account) {
      setMessage('Assign a real bill-paying account before entering its current balance.');
      return;
    }
    const rows = state.bankBalancesByMonth?.[monthKey] || [];
    const existing = rows.find((row) => row.id === accountId);
    let nextRows;
    if (balance == null) {
      nextRows = rows.filter((row) => row.id !== accountId);
    } else {
      const nextRow = {
        id: account.id,
        label: account.label,
        balance,
        ownerId: account.ownerId || 'unassigned',
        ownerLabel: accountOwnerLabel(account, peopleMap),
      };
      nextRows = existing
        ? rows.map((row) => row.id === accountId ? nextRow : row)
        : [...rows, nextRow];
    }
    mutate({
      type: 'SET_BANK_BALANCES',
      monthKey,
      items: nextRows,
      auditLabel: balance == null ? `Clear ${account.label} bank balance to TBC` : `Update ${account.label} bank balance`,
    });
  };

  const startNewMonth = (selectedIds) => {
    if (!canEditMonth || summary.isComplete) {
      setMessage('Completed months cannot be started from a previous month.');
      return;
    }
    const copies = buildRecurringBillCopies(state, monthKey, selectedIds);
    if (!copies.length) {
      setModal(null);
      setMessage('No new recurring bills were selected. Existing bills were left unchanged.');
      return;
    }
    mutate({
      type: 'COPY_RECURRING_BILLS',
      monthKey,
      sourceMonthKey: monthSetup.sourceMonthKey,
      bills: copies,
      auditLabel: `Start ${MONTHS[period.month]} ${period.year} from recurring bills`,
    });
    setModal(null);
    setMessage(`${copies.length} recurring bill${copies.length === 1 ? '' : 's'} copied into ${MONTHS[period.month]} ${period.year} as Unpaid. Exact dates remain TBC until confirmed.`);
  };

"""
replace_once('src/App.jsx', marker, handlers + marker)

# Overview props.
replace_once(
    'src/App.jsx',
    """            accountMap={accountMap}
            canEditMonth={canEditMonth}
            onUnlockMonth={unlockMonth}
            onAddIncome={() => openRecord({ mode: 'income' })}
            onAddExpense={() => openRecord({ mode: 'expense' })}
""",
    """            accountMap={accountMap}
            monthKey={monthKey}
            monthSetup={monthSetup}
            canEditMonth={canEditMonth}
            onUnlockMonth={unlockMonth}
            onStartNewMonth={() => setModal({ kind: 'month-setup' })}
            onUpdateBankBalance={updateTransferBankBalance}
            onAddIncome={() => openRecord({ mode: 'income' })}
            onAddExpense={() => openRecord({ mode: 'expense' })}
""",
)
replace_once('src/App.jsx', "            peopleMap={peopleMap}\n            mutate={mutate}\n          />\n        )}\n\n        {view === 'Year'", "            mutate={mutate}\n          />\n        )}\n\n        {view === 'Year'")

# Month setup modal.
settings_modal_marker = """      {modal?.kind === 'settings' && (
"""
month_modal = """      {modal?.kind === 'month-setup' && (
        <StartNewMonthModal
          setup={monthSetup}
          targetMonthKey={monthKey}
          peopleMap={peopleMap}
          accountMap={accountMap}
          onConfirm={startNewMonth}
          onClose={() => setModal(null)}
        />
      )}

"""
replace_once('src/App.jsx', settings_modal_marker, month_modal + settings_modal_marker)

# Overview signature and setup banner.
replace_once(
    'src/App.jsx',
    "function Overview({ summary, month, year, categoryMap, peopleMap, accountMap, canEditMonth, onUnlockMonth, onAddIncome, onAddExpense }) {",
    "function Overview({ summary, month, year, categoryMap, peopleMap, accountMap, monthKey, monthSetup, canEditMonth, onUnlockMonth, onStartNewMonth, onUpdateBankBalance, onAddIncome, onAddExpense }) {",
)
replace_once(
    'src/App.jsx',
    """  const incomeTotals = {};
  summary.incomeRecords.forEach((record) => {
    const key = `${record.incomeType}::${record.receivedBy}::${record.receivedByLabel || ''}`;
    incomeTotals[key] = (incomeTotals[key] || 0) + record.amount;
  });

  return (
""",
    """  const incomeTotals = {};
  summary.incomeRecords.forEach((record) => {
    const key = `${record.incomeType}::${record.receivedBy}::${record.receivedByLabel || ''}`;
    incomeTotals[key] = (incomeTotals[key] || 0) + record.amount;
  });
  const sourceMonthLabel = monthSetup.sourceMonthKey
    ? `${MONTHS[Number(monthSetup.sourceMonthKey.slice(5, 7)) - 1]} ${monthSetup.sourceMonthKey.slice(0, 4)}`
    : 'the previous month';

  return (
""",
)
hero_marker = """      <div className="hero-grid">
"""
setup_banner = """      {!summary.isComplete && (
        <section className="card month-setup-card" aria-labelledby="month-setup-title">
          <div className="section-heading month-setup-heading">
            <div>
              <h2 className="section-title" id="month-setup-title">Start New Month</h2>
              <p className="section-note">Copy recurring fixed bills from {sourceMonthLabel}. Penny previews everything first, starts every copy Unpaid, and never copies income or ordinary day-to-day spending.</p>
            </div>
            <button className="primary-button" disabled={!canEditMonth || monthSetup.candidates.length === 0} onClick={onStartNewMonth}>
              {monthSetup.candidates.length ? 'Start New Month' : 'No Previous Bills'}
            </button>
          </div>
          {monthSetup.candidates.length > 0 && (
            <div className="month-setup-summary">
              <span>{monthSetup.availableCount} bill{monthSetup.availableCount === 1 ? '' : 's'} available to copy</span>
              {monthSetup.duplicateCount > 0 && <span>{monthSetup.duplicateCount} already present and protected from duplication</span>}
            </div>
          )}
        </section>
      )}

"""
replace_once('src/App.jsx', hero_marker, setup_banner + hero_marker)

# Transfer plan wording and inline bank-balance editor.
replace_once(
    'src/App.jsx',
    "Use this at month-end: select the month you are preparing, enter bank balances in Savings, then move only the shortfall from savings.",
    "Use this at month-end: enter each current bank balance below, then move only the calculated shortfall from savings. Everything needed is on this screen.",
)
funding_math = """                <div className="funding-math">
                  <span>Planned costs: {formatMoney(row.amount)}</span>
                  <span>{row.hasCurrentBalance ? `Current bank balance: ${formatMoney(row.currentBalance)}` : 'Current bank balance: TBC'}</span>
                  <span className={row.transferNeeded > 0 ? 'amber' : 'green'}>Transfer needed: {row.hasCurrentBalance ? formatMoney(row.transferNeeded) : 'TBC'}</span>
                </div>
"""
funding_math_new = funding_math + """                <FundingBalanceEditor
                  row={row}
                  monthKey={monthKey}
                  canEdit={canEditMonth}
                  onCommit={(value) => onUpdateBankBalance(row.account, value)}
                />
"""
replace_once('src/App.jsx', funding_math, funding_math_new)

# Insert FundingBalanceEditor before SummaryRow.
summary_marker = "function SummaryRow({ label, value, emphasis = false }) {"
funding_editor = """function FundingBalanceEditor({ row, monthKey, canEdit, onCommit }) {
  const [draft, setDraft] = useState(row.hasCurrentBalance ? String(row.currentBalance) : '');
  useEffect(() => setDraft(row.hasCurrentBalance ? String(row.currentBalance) : ''), [row.hasCurrentBalance, row.currentBalance]);
  const editable = canEdit && row.account && row.account !== 'unassigned';
  const commit = () => {
    if (!editable) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      if (row.hasCurrentBalance) onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(row.hasCurrentBalance ? String(row.currentBalance) : '');
      return;
    }
    if (!row.hasCurrentBalance || parsed !== row.currentBalance) onCommit(parsed);
  };
  return (
    <div className="funding-balance-editor">
      <label htmlFor={`funding-balance-${monthKey}-${row.account}`}>Current bank balance</label>
      <input
        id={`funding-balance-${monthKey}-${row.account}`}
        disabled={!editable}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={draft}
        placeholder="TBC"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
      />
      <small>{editable ? 'Clear the field to return this balance to TBC.' : 'Assign a bill-paying account before entering a balance.'}</small>
    </div>
  );
}

"""
replace_once('src/App.jsx', summary_marker, funding_editor + summary_marker)

# Start New Month preview modal inserted before Savings.
savings_marker = "function Savings({ state, summary, monthKey, month, year, canEdit, peopleMap, mutate }) {"
month_setup_modal = """function StartNewMonthModal({ setup, targetMonthKey, peopleMap, accountMap, onConfirm, onClose }) {
  const [selected, setSelected] = useState(() => new Set(setup.candidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.id)));
  const targetLabel = `${MONTHS[Number(targetMonthKey.slice(5, 7)) - 1]} ${targetMonthKey.slice(0, 4)}`;
  const sourceLabel = setup.sourceMonthKey
    ? `${MONTHS[Number(setup.sourceMonthKey.slice(5, 7)) - 1]} ${setup.sourceMonthKey.slice(0, 4)}`
    : 'the previous month';
  const selectedIds = [...selected];
  const total = recurringBillSelectionTotal(setup, selectedIds);
  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <SimpleModal title={`Start ${targetLabel}`} onClose={onClose} wide>
      <p className="section-note">Review fixed bills from {sourceLabel}. Selected bills are copied as <strong>Unpaid planning records</strong>. Their exact dates remain TBC until you confirm evidence. Income, variable spending and transfers are never copied.</p>
      {setup.candidates.length ? (
        <div className="month-setup-list">
          {setup.candidates.map(({ id, transaction, duplicate }) => (
            <label className={`month-setup-row ${duplicate ? 'is-duplicate' : ''}`} key={id}>
              <input type="checkbox" disabled={duplicate} checked={!duplicate && selected.has(id)} onChange={() => toggle(id)} />
              <div className="grow">
                <div className="row-title">{transaction.desc}</div>
                <div className="muted">{transaction.paidByLabel || peopleMap[transaction.paidBy]?.label || transaction.paidBy || 'Payer TBC'} · {ownedRecordAccountLabel(transaction, accountMap, peopleMap)}</div>
                <div className="muted">Previous record: {recordDateLabel(transaction)} · New exact date will be TBC</div>
              </div>
              <div className="month-setup-row-end">
                <span className="money">{formatMoney(transaction.amount)}</span>
                {duplicate && <span className="status-pill neutral">Already exists</span>}
              </div>
            </label>
          ))}
        </div>
      ) : <div className="empty">No fixed bills were found in {sourceLabel}. Nothing will be copied.</div>}
      <div className="total-line"><span>Selected recurring bills</span><span>{selected.size}</span></div>
      <div className="total-line"><span>Planned total</span><span className="money">{formatMoney(total)}</span></div>
      <div className="actions">
        <button className="secondary-button" onClick={onClose}>Cancel</button>
        <button className="primary-button" disabled={selected.size === 0} onClick={() => onConfirm(selectedIds)}>Copy Selected Bills</button>
      </div>
    </SimpleModal>
  );
}

"""
replace_once('src/App.jsx', savings_marker, month_setup_modal + savings_marker.replace(', peopleMap', ''))

# Savings becomes savings-only: remove bank-balance state, updater, section and editor.
replace_once('src/App.jsx', "  const bankBalances = state.bankBalancesByMonth?.[monthKey] || [];\n", '')
replace_once('src/App.jsx', "  const setBankBalances = (items, label = 'Update bill-paying bank balances') => mutate({ type: 'SET_BANK_BALANCES', monthKey, items, auditLabel: label });\n", '')
regex_once(
    'src/App.jsx',
    r"  const bankBalanceMap = Object\.fromEntries\(bankBalances\.map\(\(account\) => \[account\.id, account\]\)\);\n  const updateBankBalance = \(account, balance\) => \{.*?\n  \};\n",
    '',
)
regex_once(
    'src/App.jsx',
    r"\n      \{!summary\.isComplete && \(\n        <section className=\"card\" aria-labelledby=\"bank-balances-title\">.*?</section>\n      \)\}\n",
    '\n',
)
regex_once(
    'src/App.jsx',
    r"\nfunction BankBalanceEditor\(\{ account, balance, peopleMap, canEdit, onCommit \}\) \{.*?\n\}\n\nfunction SavingsAccountEditor",
    '\nfunction SavingsAccountEditor',
)

# Package test chain.
package_path = Path('package.json')
package = json.loads(package_path.read_text())
package['scripts']['test'] = 'node scripts/self-test.mjs && node scripts/final-audit-test.mjs && node scripts/month-setup-test.mjs && node scripts/month-setup-source-audit.mjs && node scripts/source-audit.mjs'
package_path.write_text(json.dumps(package, indent=2) + '\n')

# Release version and manifest.
Path('public/version.json').write_text(json.dumps({'version': '2026-08-30-unified-month-setup-v1'}, indent=2) + '\n')
manifest_path = Path('public/manifest.webmanifest')
manifest = json.loads(manifest_path.read_text())
manifest['start_url'] = '/penny-budget/?v=2026-08-30-unified-month-setup-v1'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

# UX styles appended safely.
styles = Path('src/styles.css')
styles.write_text(styles.read_text() + """

/* Unified month setup and account funding */
.month-setup-card { border-style: solid; }
.month-setup-heading { align-items: center; }
.month-setup-summary { display: flex; gap: 8px 16px; flex-wrap: wrap; margin-top: 10px; color: var(--muted); font-size: 0.86rem; }
.month-setup-list { display: grid; gap: 8px; margin: 16px 0; }
.month-setup-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); cursor: pointer; }
.month-setup-row.is-duplicate { opacity: 0.65; cursor: default; }
.month-setup-row > input { margin-top: 4px; min-width: 18px; min-height: 18px; }
.month-setup-row-end { display: grid; justify-items: end; gap: 6px; }
.funding-balance-editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(110px, 150px); gap: 6px 10px; align-items: center; margin-top: 10px; max-width: 390px; }
.funding-balance-editor label { font-size: 0.78rem; color: var(--muted); }
.funding-balance-editor input { width: 100%; }
.funding-balance-editor small { grid-column: 1 / -1; color: var(--muted); }
@media (max-width: 620px) {
  .month-setup-heading { align-items: stretch; }
  .month-setup-heading .primary-button { width: 100%; }
  .month-setup-row { align-items: flex-start; }
  .month-setup-row-end { min-width: 88px; }
  .funding-balance-editor { grid-template-columns: 1fr; max-width: none; }
  .funding-balance-editor small { grid-column: auto; }
}
""")

# Changelog entry.
changelog = Path('CHANGELOG.md')
existing = changelog.read_text()
entry = """## 2026-08-30 — Unified month setup and funding\n\n- Moved bill-paying bank balance entry into the Overview transfer plan so the complete month-end funding workflow is on one screen.\n- Added Start New Month preview/copy for recurring fixed bills from the previous month.\n- Copied bills always start Unpaid and Exact date TBC; income, variable spending and transfers are never copied.\n- Added reducer-level duplicate protection and one audit-history event for each month setup.\n- Clearing a bank-balance input returns it to TBC instead of silently confirming zero.\n\n"""
changelog.write_text(entry + existing)

print('Unified month setup patch applied')
