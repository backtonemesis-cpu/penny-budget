import { MAX_AUDIT_ENTRIES, createId, isValidMonthKey } from './finance.js';
import { getMonthAccounts, getMonthHiddenCats, getMonthPeople } from './month-scope.js';
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
    || (state.savingsByMonth?.[monthKey] || []).length
    || getMonthPeople(state, monthKey).length
    || getMonthAccounts(state, monthKey).length
    || getMonthHiddenCats(state, monthKey).length
    || state.budgetsByMonth?.[monthKey]
    || state.monthMetaByMonth?.[monthKey]
  );
}

function withoutKey(record = {}, key) {
  const next = { ...record };
  delete next[key];
  return next;
}

function emptyMonthList(record = {}, key) {
  return { ...record, [key]: [] };
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
  const completed = state.monthMetaByMonth?.[monthKey]?.status === 'complete';
  const lockedBannerVisible = Boolean(document.querySelector('.locked-banner'));
  if (completed && lockedBannerVisible) {
    globalThis.alert(`${label} is a completed historical month. Unlock corrections on Overview first, then use Clear month again.`);
    return;
  }
  if (!hasMonthData(state, monthKey)) {
    globalThis.alert(`${label} is already a blank standalone month.`);
    return;
  }

  const before = {
    transactions: state.txnsByMonth?.[monthKey] || [],
    income: state.incomeByMonth?.[monthKey] || [],
    people: getMonthPeople(state, monthKey),
    accounts: getMonthAccounts(state, monthKey),
    hiddenCategories: getMonthHiddenCats(state, monthKey),
    bankBalances: state.bankBalancesByMonth?.[monthKey] || [],
    savings: state.savingsByMonth?.[monthKey] || [],
    budget: state.budgetsByMonth?.[monthKey] || null,
    monthMeta: state.monthMetaByMonth?.[monthKey] || null,
  };

  const confirmed = globalThis.confirm(
    `Reset ${label} to a completely blank month?\n\nThis removes only ${label}'s household people, accounts and owners, transactions, income, bank balances, savings snapshot, budget/setup and month status.\n\nNo other month is changed. Historical evidence from other months remains untouched. This reset will be recorded in Change History.`
  );
  if (!confirmed) return;

  const next = {
    ...state,
    txnsByMonth: withoutKey(state.txnsByMonth, monthKey),
    incomeByMonth: withoutKey(state.incomeByMonth, monthKey),
    peopleByMonth: emptyMonthList(state.peopleByMonth, monthKey),
    accountsByMonth: emptyMonthList(state.accountsByMonth, monthKey),
    hiddenCatsByMonth: emptyMonthList(state.hiddenCatsByMonth, monthKey),
    bankBalancesByMonth: withoutKey(state.bankBalancesByMonth, monthKey),
    savingsByMonth: withoutKey(state.savingsByMonth, monthKey),
    budgetsByMonth: withoutKey(state.budgetsByMonth, monthKey),
    monthMetaByMonth: withoutKey(state.monthMetaByMonth, monthKey),
    auditLog: [{
      id: createId('audit'),
      at: new Date().toISOString(),
      action: 'clear_month',
      entityType: 'monthly_setup',
      entityId: '',
      monthKey,
      label: `Reset ${label} to blank`,
      before,
      after: { transactions: [], income: [], people: [], accounts: [], hiddenCategories: [], bankBalances: [], savings: [], budget: null, monthMeta: null },
    }, ...(state.auditLog || [])].slice(0, MAX_AUDIT_ENTRIES),
  };

  const result = saveState(storage, next);
  if (!result.ok) {
    globalThis.alert(result.error || 'Penny could not save the cleared month.');
    return;
  }
  globalThis.location.reload();
}

function backupRecoverySection() {
  return [...document.querySelectorAll('.settings-section')].find((section) =>
    section.querySelector('h3')?.textContent?.trim() === 'Backup and Recovery'
  ) || null;
}

function ensureClearMonthControl() {
  const target = backupRecoverySection();
  if (!target) return;
  const monthKey = selectedMonthKey();
  if (!monthKey) return;
  const label = monthLabel(monthKey);
  const buttonLabel = `Reset ${label} to blank`;

  const existing = target.querySelector('[data-penny-clear-month-settings]');
  if (existing) {
    const button = existing.querySelector('[data-penny-clear-month]');
    if (button && button.textContent !== buttonLabel) button.textContent = buttonLabel;
    return;
  }

  const eraseButton = [...target.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Erase Penny data on this device')
  );
  const wrap = document.createElement('div');
  wrap.className = 'settings-month-data-row';
  wrap.setAttribute('data-penny-clear-month-settings', '');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'danger-button settings-clear-month-button';
  button.setAttribute('data-penny-clear-month', '');
  button.textContent = buttonLabel;
  button.addEventListener('click', clearSelectedMonth);
  wrap.append(button);
  if (eraseButton) target.insertBefore(wrap, eraseButton);
  else target.appendChild(wrap);
}

export function installMonthClearControl() {
  ensureClearMonthControl();
  const root = document.getElementById('root');
  if (!root) return;
  let scheduled = false;
  const scheduleEnsure = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureClearMonthControl();
    });
  };
  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(root, { childList: true, subtree: true });
  document.addEventListener('change', (event) => {
    if (event.target?.classList?.contains('month-input')) scheduleEnsure();
  });
}
