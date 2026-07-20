import { createBlankState, isValidMonthKey, positiveNumber } from './finance.js';

function withoutEmptyMonth(record, monthKey, nextValue) {
  const next = { ...record };
  if (Array.isArray(nextValue) ? nextValue.length : Object.keys(nextValue || {}).length) next[monthKey] = nextValue;
  else delete next[monthKey];
  return next;
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
      const nextRows = [action.txn, ...rows]
        .filter((transaction, index, all) => all.findIndex((candidate) => candidate.id === transaction.id) === index)
        .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
      return { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: nextRows } };
    }
    case 'DELETE_TXN': {
      const rows = (state.txnsByMonth[action.monthKey] || []).filter((transaction) => transaction.id !== action.id);
      return { ...state, txnsByMonth: withoutEmptyMonth(state.txnsByMonth, action.monthKey, rows) };
    }
    case 'SET_INCOME': {
      const rows = Array.isArray(action.sources) ? action.sources : [];
      return { ...state, incomeByMonth: withoutEmptyMonth(state.incomeByMonth, action.monthKey, rows) };
    }
    case 'ADD_CAT':
      if (!action.cat || state.customCats.some((category) => category.id === action.cat.id)) return state;
      return { ...state, customCats: [...state.customCats, action.cat] };
    case 'REMOVE_CAT': {
      const budgetsByMonth = Object.fromEntries(
        Object.entries(state.budgetsByMonth).flatMap(([monthKey, budgets]) => {
          const { [action.id]: _removed, ...remaining } = budgets;
          return Object.keys(remaining).length ? [[monthKey, remaining]] : [];
        }),
      );
      const { [action.id]: _due, ...dueDays } = state.dueDays;
      return {
        ...state,
        customCats: state.customCats.filter((category) => category.id !== action.id),
        hiddenCats: state.hiddenCats.filter((id) => id !== action.id),
        budgetsByMonth,
        dueDays,
      };
    }
    case 'TOGGLE_HIDE':
      return {
        ...state,
        hiddenCats: state.hiddenCats.includes(action.id)
          ? state.hiddenCats.filter((id) => id !== action.id)
          : [...state.hiddenCats, action.id],
      };
    case 'SET_BUDGET': {
      if (!isValidMonthKey(action.monthKey)) return state;
      const amount = positiveNumber(action.value);
      const monthBudgets = { ...(state.budgetsByMonth[action.monthKey] || {}) };
      if (amount > 0) monthBudgets[action.id] = amount;
      else delete monthBudgets[action.id];
      return {
        ...state,
        budgetsByMonth: withoutEmptyMonth(state.budgetsByMonth, action.monthKey, monthBudgets),
      };
    }
    case 'COPY_BUDGETS': {
      const source = state.budgetsByMonth[action.fromMonthKey] || {};
      if (!isValidMonthKey(action.toMonthKey) || !Object.keys(source).length) return state;
      return {
        ...state,
        budgetsByMonth: { ...state.budgetsByMonth, [action.toMonthKey]: { ...source } },
      };
    }
    case 'SET_DUE_DAY': {
      const dueDays = { ...state.dueDays };
      const day = Number(action.day);
      if (!Number.isInteger(day) || day < 1 || day > 31) delete dueDays[action.id];
      else dueDays[action.id] = day;
      return { ...state, dueDays };
    }
    case 'SET_SAVINGS':
      return { ...state, [action.field]: positiveNumber(action.value) };
    default:
      return state;
  }
}

export function categoryInUse(state, categoryId) {
  return Object.values(state.txnsByMonth).some((rows) => rows.some((transaction) => transaction.category === categoryId));
}
