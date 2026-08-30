import {
  MAX_AUDIT_ENTRIES,
  createBlankState,
  createId,
  isValidMonthKey,
  positiveNumber,
} from './finance.js';
import { recurringBillKey, recurringIncomeKey } from './month-setup.js';

function withoutEmptyMonth(record, monthKey, nextValue) {
  const next = { ...record };
  if (Array.isArray(nextValue) ? nextValue.length : Object.keys(nextValue || {}).length) next[monthKey] = nextValue;
  else delete next[monthKey];
  return next;
}

function sortByDate(rows) {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
}

function appendAudit(nextState, action, event) {
  if (action.audit === false || !event) return nextState;
  const entry = {
    id: action.auditId || createId('audit'),
    at: action.auditAt || new Date().toISOString(),
    action: event.action,
    entityType: event.entityType || 'state',
    entityId: event.entityId || '',
    monthKey: isValidMonthKey(event.monthKey) ? event.monthKey : '',
    label: action.auditLabel || event.label || event.action,
    before: event.before ?? null,
    after: event.after ?? null,
  };
  return {
    ...nextState,
    auditLog: [entry, ...(nextState.auditLog || [])].slice(0, MAX_AUDIT_ENTRIES),
  };
}

export function appReducer(state, action) {
  switch (action.type) {
    case 'RESTORE': {
      if (!action.state) return state;
      if (!action.auditEvent) return action.state;
      return appendAudit(action.state, action, action.auditEvent);
    }
    case 'RESET':
      return createBlankState();
    case 'ADD_TXN': {
      if (!isValidMonthKey(action.monthKey) || !action.txn) return state;
      const rows = state.txnsByMonth[action.monthKey] || [];
      const nextRows = sortByDate([action.txn, ...rows].filter((transaction, index, all) => all.findIndex((candidate) => candidate.id === transaction.id) === index));
      const next = { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: nextRows } };
      return appendAudit(next, action, { action: 'add', entityType: 'expense_or_movement', entityId: action.txn.id, monthKey: action.monthKey, label: action.txn.desc, after: action.txn });
    }
    case 'UPDATE_TXN': {
      if (!isValidMonthKey(action.monthKey) || !action.txn) return state;
      const rows = state.txnsByMonth[action.monthKey] || [];
      const before = rows.find((transaction) => transaction.id === action.txn.id);
      if (!before) return state;
      const nextRows = sortByDate(rows.map((transaction) => transaction.id === action.txn.id ? action.txn : transaction));
      const next = { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: nextRows } };
      return appendAudit(next, action, { action: 'update', entityType: 'expense_or_movement', entityId: action.txn.id, monthKey: action.monthKey, label: action.txn.desc, before, after: action.txn });
    }
    case 'DELETE_TXN': {
      const existingRows = state.txnsByMonth[action.monthKey] || [];
      const before = existingRows.find((transaction) => transaction.id === action.id);
      if (!before) return state;
      const rows = existingRows.filter((transaction) => transaction.id !== action.id);
      const next = { ...state, txnsByMonth: withoutEmptyMonth(state.txnsByMonth, action.monthKey, rows) };
      return appendAudit(next, action, { action: 'delete', entityType: 'expense_or_movement', entityId: action.id, monthKey: action.monthKey, label: before.desc, before });
    }
    case 'TOGGLE_PAID': {
      const rows = state.txnsByMonth[action.monthKey] || [];
      const before = rows.find((transaction) => transaction.id === action.id && transaction.type === 'expense');
      if (!before) return state;
      const after = { ...before, paid: !before.paid };
      const nextRows = rows.map((transaction) => transaction.id === action.id ? after : transaction);
      const next = { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: nextRows } };
      return appendAudit(next, action, { action: after.paid ? 'mark_paid' : 'mark_unpaid', entityType: 'expense', entityId: action.id, monthKey: action.monthKey, label: before.desc, before, after });
    }
    case 'START_NEW_MONTH': {
      if (!isValidMonthKey(action.monthKey)) return state;
      const existingTxns = state.txnsByMonth[action.monthKey] || [];
      const billKeys = new Set(existingTxns.filter((row) => row.type === 'expense' && row.expenseClass === 'fixed').map(recurringBillKey).filter(Boolean));
      const copiedBills = [];
      (action.bills || []).forEach((bill) => {
        const key = recurringBillKey(bill);
        if (!key || billKeys.has(key)) return;
        billKeys.add(key);
        copiedBills.push({ ...bill, paid: false, source: 'month_copy' });
      });
      const existingIncome = state.incomeByMonth[action.monthKey] || [];
      const incomeKeys = new Set(existingIncome.map(recurringIncomeKey).filter(Boolean));
      const copiedIncome = [];
      (action.income || []).forEach((record) => {
        const key = recurringIncomeKey(record);
        if (!key || incomeKeys.has(key)) return;
        incomeKeys.add(key);
        copiedIncome.push({ ...record, source: 'month_copy', incomeStatus: 'expected' });
      });
      const sourceBudget = isValidMonthKey(action.sourceMonthKey) ? state.budgetsByMonth?.[action.sourceMonthKey] : null;
      const copyBudget = sourceBudget && !state.budgetsByMonth?.[action.monthKey];
      if (!copiedBills.length && !copiedIncome.length && !copyBudget) return state;
      const next = {
        ...state,
        txnsByMonth: copiedBills.length ? { ...state.txnsByMonth, [action.monthKey]: sortByDate([...copiedBills, ...existingTxns]) } : state.txnsByMonth,
        incomeByMonth: copiedIncome.length ? { ...state.incomeByMonth, [action.monthKey]: sortByDate([...copiedIncome, ...existingIncome]) } : state.incomeByMonth,
        budgetsByMonth: copyBudget ? { ...state.budgetsByMonth, [action.monthKey]: { ...sourceBudget } } : state.budgetsByMonth,
      };
      return appendAudit(next, action, {
        action: 'start_month',
        entityType: 'monthly_setup',
        monthKey: action.monthKey,
        label: `Started month with ${copiedBills.length} bill${copiedBills.length === 1 ? '' : 's'} and ${copiedIncome.length} income item${copiedIncome.length === 1 ? '' : 's'}`,
        after: { sourceMonthKey: action.sourceMonthKey || '', copiedBills, copiedIncome, copiedBudget: Boolean(copyBudget) },
      });
    }
    case 'SPLIT_ACCOUNT_FOR_MONTH': {
      if (!isValidMonthKey(action.monthKey) || !action.sourceAccountId || !Array.isArray(action.mappings) || action.mappings.length < 2) return state;
      const mappingByPayer = new Map(action.mappings.filter((mapping) => mapping?.paidBy && mapping?.account?.id).map((mapping) => [mapping.paidBy, mapping.account]));
      if (mappingByPayer.size < 2) return state;
      const rows = state.txnsByMonth[action.monthKey] || [];
      let changed = 0;
      const nextRows = rows.map((transaction) => {
        if (transaction.type !== 'expense' || transaction.account !== action.sourceAccountId) return transaction;
        const account = mappingByPayer.get(transaction.paidBy);
        if (!account) return transaction;
        changed += 1;
        return { ...transaction, account: account.id, accountLabel: account.label, accountOwnerId: account.ownerId, accountOwnerLabel: action.peopleLabels?.[account.ownerId] || transaction.paidByLabel || '' };
      });
      if (!changed) return state;
      const accounts = [...state.accounts];
      action.mappings.forEach((mapping) => {
        if (!accounts.some((account) => account.id === mapping.account.id)) accounts.push(mapping.account);
      });
      const bankRows = (state.bankBalancesByMonth?.[action.monthKey] || []).filter((row) => row.id !== action.sourceAccountId);
      const bankBalancesByMonth = { ...(state.bankBalancesByMonth || {}) };
      if (bankRows.length) bankBalancesByMonth[action.monthKey] = bankRows;
      else delete bankBalancesByMonth[action.monthKey];
      const next = { ...state, accounts, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: sortByDate(nextRows) }, bankBalancesByMonth };
      return appendAudit(next, action, {
        action: 'split_account',
        entityType: 'account_resolution',
        monthKey: action.monthKey,
        label: `Separated ${action.sourceAccountLabel || 'account'} by owner`,
        before: { sourceAccountId: action.sourceAccountId },
        after: { mappings: action.mappings, reassignedTransactions: changed, clearedCurrentMonthBalance: true },
      });
    }
    case 'COPY_RECURRING_BILLS': {
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
    case 'ADD_INCOME': {
      if (!isValidMonthKey(action.monthKey) || !action.record) return state;
      const rows = state.incomeByMonth[action.monthKey] || [];
      const nextRows = sortByDate([action.record, ...rows].filter((record, index, all) => all.findIndex((candidate) => candidate.id === record.id) === index));
      const next = { ...state, incomeByMonth: { ...state.incomeByMonth, [action.monthKey]: nextRows } };
      return appendAudit(next, action, { action: 'add', entityType: 'income', entityId: action.record.id, monthKey: action.monthKey, label: action.record.description, after: action.record });
    }
    case 'UPDATE_INCOME': {
      if (!isValidMonthKey(action.monthKey) || !action.record) return state;
      const rows = state.incomeByMonth[action.monthKey] || [];
      const before = rows.find((record) => record.id === action.record.id);
      if (!before) return state;
      const nextRows = sortByDate(rows.map((record) => record.id === action.record.id ? action.record : record));
      const next = { ...state, incomeByMonth: { ...state.incomeByMonth, [action.monthKey]: nextRows } };
      return appendAudit(next, action, { action: 'update', entityType: 'income', entityId: action.record.id, monthKey: action.monthKey, label: action.record.description, before, after: action.record });
    }
    case 'DELETE_INCOME': {
      const existingRows = state.incomeByMonth[action.monthKey] || [];
      const before = existingRows.find((record) => record.id === action.id);
      if (!before) return state;
      const rows = existingRows.filter((record) => record.id !== action.id);
      const next = { ...state, incomeByMonth: withoutEmptyMonth(state.incomeByMonth, action.monthKey, rows) };
      return appendAudit(next, action, { action: 'delete', entityType: 'income', entityId: action.id, monthKey: action.monthKey, label: before.description, before });
    }
    case 'ADD_CAT': {
      if (!action.cat || state.customCats.some((category) => category.id === action.cat.id)) return state;
      const next = { ...state, customCats: [...state.customCats, action.cat] };
      return appendAudit(next, action, { action: 'add', entityType: 'category', entityId: action.cat.id, label: action.cat.label, after: action.cat });
    }
    case 'REMOVE_CAT': {
      const before = state.customCats.find((category) => category.id === action.id);
      if (!before) return state;
      const next = {
        ...state,
        customCats: state.customCats.filter((category) => category.id !== action.id),
        hiddenCats: state.hiddenCats.filter((id) => id !== action.id),
      };
      return appendAudit(next, action, { action: 'delete', entityType: 'category', entityId: action.id, label: before.label, before });
    }
    case 'TOGGLE_HIDE': {
      const hidden = state.hiddenCats.includes(action.id);
      const next = {
        ...state,
        hiddenCats: hidden ? state.hiddenCats.filter((id) => id !== action.id) : [...state.hiddenCats, action.id],
      };
      return appendAudit(next, action, { action: hidden ? 'show' : 'hide', entityType: 'category', entityId: action.id, label: action.id });
    }
    case 'SET_REFERENCE_LIST': {
      if (!['people', 'accounts'].includes(action.field) || !Array.isArray(action.items)) return state;
      const before = state[action.field];
      const items = action.field === 'accounts'
        ? action.items.map((item) => ({ ...item, ownerId: item?.ownerId || 'unassigned' }))
        : action.items;
      const next = { ...state, [action.field]: items };
      return appendAudit(next, action, { action: 'update', entityType: action.field, label: action.field === 'people' ? 'Household people' : 'Accounts', before, after: items });
    }
    case 'SET_SAVINGS_ACCOUNTS': {
      if (!isValidMonthKey(action.monthKey)) return state;
      const before = state.savingsByMonth[action.monthKey] || [];
      const normalisedItems = Array.isArray(action.items)
        ? action.items.map((item) => ({ ...item, balance: positiveNumber(item?.balance) }))
        : [];
      const savingsByMonth = { ...state.savingsByMonth };
      if (normalisedItems.length) savingsByMonth[action.monthKey] = normalisedItems;
      else delete savingsByMonth[action.monthKey];
      const next = { ...state, savingsByMonth };
      return appendAudit(next, action, { action: 'update', entityType: 'savings_snapshot', monthKey: action.monthKey, label: 'Savings snapshot', before, after: normalisedItems });
    }
    case 'SET_BANK_BALANCES': {
      if (!isValidMonthKey(action.monthKey)) return state;
      const before = state.bankBalancesByMonth?.[action.monthKey] || [];
      const normalisedItems = Array.isArray(action.items)
        ? action.items
          .filter((item) => item?.id && item?.label && item.id !== 'unassigned')
          .map((item) => ({ id: item.id, label: item.label, balance: positiveNumber(item?.balance), ownerId: item?.ownerId || 'unassigned', ownerLabel: item?.ownerLabel || '' }))
        : [];
      const bankBalancesByMonth = { ...(state.bankBalancesByMonth || {}) };
      if (normalisedItems.length) bankBalancesByMonth[action.monthKey] = normalisedItems;
      else delete bankBalancesByMonth[action.monthKey];
      const next = { ...state, bankBalancesByMonth };
      return appendAudit(next, action, { action: 'update', entityType: 'bank_balance_snapshot', monthKey: action.monthKey, label: 'Bill-paying bank balances', before, after: normalisedItems });
    }
    case 'SET_SAVINGS': {
      if (!['savingsGoal', 'savingsContrib'].includes(action.field)) return state;
      const before = state[action.field];
      const after = positiveNumber(action.value);
      const next = { ...state, [action.field]: after };
      return appendAudit(next, action, { action: 'update', entityType: 'planning_setting', entityId: action.field, label: action.field, before: { value: before }, after: { value: after } });
    }
    default:
      return state;
  }
}

export function categoryInUse(state, categoryId) {
  return Object.values(state.txnsByMonth).some((rows) => rows.some((transaction) => transaction.category === categoryId));
}

export function referenceInUse(state, field, referenceId) {
  if (field === 'people') {
    return Object.values(state.txnsByMonth).some((rows) => rows.some((transaction) => transaction.paidBy === referenceId))
      || Object.values(state.incomeByMonth).some((rows) => rows.some((record) => record.receivedBy === referenceId))
      || (state.accounts || []).some((account) => account.ownerId === referenceId);
  }
  if (field === 'accounts') {
    return Object.values(state.txnsByMonth).some((rows) => rows.some((transaction) => transaction.account === referenceId))
      || Object.values(state.incomeByMonth).some((rows) => rows.some((record) => record.account === referenceId))
      || Object.values(state.bankBalancesByMonth || {}).some((rows) => rows.some((record) => record.id === referenceId));
  }
  return false;
}
