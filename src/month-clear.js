import { MAX_AUDIT_ENTRIES, createId, isValidMonthKey } from './finance.js';
import { getBrowserStorage, loadState, saveState } from './storage.js';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function selectedMonthKey() {
  const input = document.querySelector('.month-input');
  return isValidMonthKey(input?.value) ? input.value : '';
}

function monthLabel(monthKey) {
  if (!isValidMonthKey(monthKey)) return 'this month';
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function hasMonthData(state, monthKey) {
  return Boolean(
    (state.txnsByMonth?.[monthKey] || []).length
    || (state.incomeByMonth?.[monthKey] || []).length
    || (state.bankBalancesByMonth?.[monthKey] || []).length
    || state.budgetsByMonth?.[monthKey]
  );
}

function withoutKey(record = {}, key) {
  const next = { ...record };
  delete next[key];
  return next;
}

function clearSelectedMonth() {
  const monthKey = selectedMonthKey();
  if (!monthKey) return;

  const storage = getBrowserStorage();
  const loaded = loadState(storage, new Date());
  if (loaded.recoveryRequired) {
    globalThis.alert('Penny cannot clear this month while storage recovery is required. Restore or erase the damaged local copy in Settings first.');
    return;
  }

  const state = loaded.state;
  const label = monthLabel(monthKey);
  if (state.monthMetaByMonth?.[monthKey]?.status === 'complete') {
    globalThis.alert(`${label} is a completed historical month and cannot be cleared. Historical evidence must remain protected.`);
    return;
  }
  if (!hasMonthData(state, monthKey)) {
    globalThis.alert(`${label} has no month data to clear.`);
    return;
  }

  const before = {
    transactions: state.txnsByMonth?.[monthKey] || [],
    income: state.incomeByMonth?.[monthKey] || [],
    bankBalances: state.bankBalancesByMonth?.[monthKey] || [],
    budget: state.budgetsByMonth?.[monthKey] || null,
  };
  const transactionCount = before.transactions.length;
  const incomeCount = before.income.length;

  const confirmed = globalThis.confirm(
    `Clear ${label}?\n\nThis will remove ${transactionCount} transaction${transactionCount === 1 ? '' : 's'}, ${incomeCount} income item${incomeCount === 1 ? '' : 's'}, current bank-balance entries and month-specific budget/setup data for ${label}.\n\nOther months, accounts, categories and savings history will not be changed. This action will be recorded in Change History.`
  );
  if (!confirmed) return;

  const next = {
    ...state,
    txnsByMonth: withoutKey(state.txnsByMonth, monthKey),
    incomeByMonth: withoutKey(state.incomeByMonth, monthKey),
    bankBalancesByMonth: withoutKey(state.bankBalancesByMonth, monthKey),
    budgetsByMonth: withoutKey(state.budgetsByMonth, monthKey),
    auditLog: [{
      id: createId('audit'),
      at: new Date().toISOString(),
      action: 'clear_month',
      entityType: 'monthly_setup',
      entityId: '',
      monthKey,
      label: `Cleared ${label}`,
      before,
      after: { transactions: [], income: [], bankBalances: [], budget: null },
    }, ...(state.auditLog || [])].slice(0, MAX_AUDIT_ENTRIES),
  };

  const result = saveState(storage, next);
  if (!result.ok) {
    globalThis.alert(result.error || 'Penny could not save the cleared month.');
    return;
  }
  globalThis.location.reload();
}

function ensureClearMonthControl() {
  const overviewActive = [...document.querySelectorAll('.nav button')].some((button) => button.textContent?.trim() === 'Overview' && button.classList.contains('active'));
  const existing = document.querySelector('[data-penny-clear-month]');
  if (!overviewActive) {
    existing?.remove();
    return;
  }

  const monthKey = selectedMonthKey();
  if (!monthKey) return;
  const target = document.querySelector('.month-setup-card') || document.querySelector('.attention-card') || document.querySelector('.metric-grid');
  if (!target) return;

  if (existing) {
    existing.textContent = `Clear ${MONTH_NAMES[Number(monthKey.slice(5, 7)) - 1]}`;
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'clear-month-row';
  wrap.setAttribute('data-penny-clear-month-row', '');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'clear-month-button';
  button.setAttribute('data-penny-clear-month', '');
  button.textContent = `Clear ${MONTH_NAMES[Number(monthKey.slice(5, 7)) - 1]}`;
  button.addEventListener('click', clearSelectedMonth);
  wrap.appendChild(button);

  if (target.classList.contains('month-setup-card')) target.appendChild(wrap);
  else target.insertAdjacentElement('afterend', wrap);
}

export function installMonthClearControl() {
  ensureClearMonthControl();
  const observer = new MutationObserver(() => ensureClearMonthControl());
  observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  document.addEventListener('change', (event) => {
    if (event.target?.classList?.contains('month-input')) queueMicrotask(ensureClearMonthControl);
  });
}
