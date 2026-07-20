import { createBlankState, isValidMonthKey, positiveNumber } from './finance.js';

function withoutEmptyMonth(record, monthKey, nextValue) {
  const next = { ...record };
  if (Array.isArray(nextValue) ? nextValue.length : Object.keys(nextValue || {}).length) next[monthKey] = nextValue;
  else delete next[monthKey];
  return next;
}

function sortByDate(rows) {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
}

export function appReducer(state, action) {
  switch (action.type) {
    case 'RESTORE':
      return action.state;
    case 'RESET':
      return createBlankState();
    case 'ADD_TXN': {
      if (!isValidMonthKey(action.monthKey) || !action.txn) return state;
      const rows = state.txnsByMonth[action.monthKey] || [];
      const nextRows = sortByDate([action.txn, ...rows].filter((transaction, index, all) => all.findIndex((candidate) => candidate.id === transaction.id) === index));
      return { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: nextRows } };
    }
    case 'UPDATE_TXN': {
      if (!isValidMonthKey(action.monthKey) || !action.txn) return state;
      const rows = state.txnsByMonth[action.monthKey] || [];
      if (!rows.some((transaction) => transaction.id === action.txn.id)) return state;
      const nextRows = sortByDate(rows.map((transaction) => transaction.id === action.txn.id ? action.txn : transaction));
      return { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: nextRows } };
    }
    case 'DELETE_TXN': {
      const rows = (state.txnsByMonth[action.monthKey] || []).filter((transaction) => transaction.id !== action.id);
      return { ...state, txnsByMonth: withoutEmptyMonth(state.txnsByMonth, action.monthKey, rows) };
    }
    case 'TOGGLE_PAID': {
      const rows = state.txnsByMonth[action.monthKey] || [];
      const nextRows = rows.map((transaction) => transaction.id === action.id && transaction.type === 'expense'
        ? { ...transaction, paid: !transaction.paid }
        : transaction);
      return { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: nextRows } };
    }
    case 'ADD_INCOME': {
      if (!isValidMonthKey(action.monthKey) || !action.record) return state;
      const rows = state.incomeByMonth[action.monthKey] || [];
      const nextRows = sortByDate([action.record, ...rows].filter((record, index, all) => all.findIndex((candidate) => candidate.id === record.id) === index));
      return { ...state, incomeByMonth: { ...state.incomeByMonth, [action.monthKey]: nextRows } };
    }
    case 'UPDATE_INCOME': {
      if (!isValidMonthKey(action.monthKey) || !action.record) return state;
      const rows = state.incomeByMonth[action.monthKey] || [];
      if (!rows.some((record) => record.id === action.record.id)) return state;
      const nextRows = sortByDate(rows.map((record) => record.id === action.record.id ? action.record : record));
      return { ...state, incomeByMonth: { ...state.incomeByMonth, [action.monthKey]: nextRows } };
    }
    case 'DELETE_INCOME': {
      const rows = (state.incomeByMonth[action.monthKey] || []).filter((record) => record.id !== action.id);
      return { ...state, incomeByMonth: withoutEmptyMonth(state.incomeByMonth, action.monthKey, rows) };
    }
    case 'ADD_CAT':
      if (!action.cat || state.customCats.some((category) => category.id === action.cat.id)) return state;
      return { ...state, customCats: [...state.customCats, action.cat] };
    case 'REMOVE_CAT':
      return {
        ...state,
        customCats: state.customCats.filter((category) => category.id !== action.id),
        hiddenCats: state.hiddenCats.filter((id) => id !== action.id),
      };
    case 'TOGGLE_HIDE':
      return {
        ...state,
        hiddenCats: state.hiddenCats.includes(action.id)
          ? state.hiddenCats.filter((id) => id !== action.id)
          : [...state.hiddenCats, action.id],
      };
    case 'SET_REFERENCE_LIST':
      if (!['people', 'accounts'].includes(action.field) || !Array.isArray(action.items)) return state;
      return { ...state, [action.field]: action.items };
    case 'SET_SAVINGS_ACCOUNTS':
      return { ...state, savingsAccounts: Array.isArray(action.items) ? action.items : [] };
    case 'SET_SAVINGS':
      if (!['savingsGoal', 'savingsContrib'].includes(action.field)) return state;
      return { ...state, [action.field]: positiveNumber(action.value) };
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
      || Object.values(state.incomeByMonth).some((rows) => rows.some((record) => record.receivedBy === referenceId));
  }
  if (field === 'accounts') {
    return Object.values(state.txnsByMonth).some((rows) => rows.some((transaction) => transaction.account === referenceId))
      || Object.values(state.incomeByMonth).some((rows) => rows.some((record) => record.account === referenceId));
  }
  return false;
}
