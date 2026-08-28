import { BASE_CATEGORIES } from './catalog.js';

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const TRANSACTION_TYPES = new Set(['expense','internal_transfer','savings_transfer','card_repayment','refund']);
export const CURRENT_STATE_VERSION = 6;

const BASE_CATEGORY_MAP = Object.fromEntries(BASE_CATEGORIES.map((category) => [category.id, category]));

export function mkKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function isValidMonthKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function previousMonthKey(monthKey) {
  if (!isValidMonthKey(monthKey)) return null;
  const [year, month] = monthKey.split('-').map(Number);
  const previous = new Date(year, month - 2, 1);
  return mkKey(previous.getFullYear(), previous.getMonth());
}

export function createId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function positiveNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function signedNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function nonNegativeNumber(value) {
  return Math.max(0, signedNumber(value));
}

export function formatMoney(value, { plus = false, decimals = 2 } = {}) {
  const number = Number(value) || 0;
  const sign = number < 0 ? '-' : plus && number > 0 ? '+' : '';
  return `${sign}£${Math.abs(number).toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatDate(value) {
  if (!isValidDateKey(value)) return value || 'Date not confirmed';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function cleanText(value, fallback = '', maxLength = 120) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return (cleaned || fallback).slice(0, maxLength);
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normaliseReferenceList(value, prefix) {
  if (!Array.isArray(value)) return [];
  return uniqueById(value.flatMap((item) => {
    const label = cleanText(item?.label, '', 80);
    const id = cleanText(item?.id, '', 120);
    if (!label || !id || id === 'unassigned' || id === 'household') return [];
    return [{ id: id || createId(prefix), label }];
  }));
}

function normaliseSavingsAccounts(value) {
  if (!Array.isArray(value)) return [];
  return uniqueById(value.flatMap((item) => {
    const label = cleanText(item?.label, '', 80);
    const id = cleanText(item?.id, '', 120);
    if (!label || !id) return [];
    return [{ id, label, balance: nonNegativeNumber(item?.balance) }];
  }));
}

function normaliseSavingsByMonth(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([monthKey, rows]) => isValidMonthKey(monthKey) && Array.isArray(rows))
      .map(([monthKey, rows]) => [monthKey, normaliseSavingsAccounts(rows)])
      .filter(([, rows]) => rows.length),
  );
}

function normaliseMonthMetaByMonth(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([monthKey, meta]) => {
      if (!isValidMonthKey(monthKey) || !meta || typeof meta !== 'object' || Array.isArray(meta)) return [];
      if (meta.status !== 'complete') return [];
      return [[monthKey, {
        status: 'complete',
        startingSavings: nonNegativeNumber(meta.startingSavings),
      }]];
    }),
  );
}

function normaliseCustomCategories(value) {
  if (!Array.isArray(value)) return [];
  return uniqueById(value.flatMap((category) => {
    const id = cleanText(category?.id, '', 120);
    const label = cleanText(category?.label, '', 80);
    if (!id || !label) return [];
    const defaultClass = category?.defaultClass === 'fixed' || category?.bill ? 'fixed' : 'variable';
    return [{
      id,
      label,
      icon: cleanText(category?.icon, '🏷️', 8),
      group: cleanText(category?.group, defaultClass === 'fixed' ? 'Bills' : 'Other', 40),
      defaultClass,
      fixed: false,
    }];
  }));
}

function categoryDefaultClass(categoryId, customCategories = []) {
  const custom = customCategories.find((category) => category.id === categoryId);
  return custom?.defaultClass || BASE_CATEGORY_MAP[categoryId]?.defaultClass || 'variable';
}

export function normaliseTransaction(transaction, customCategories = []) {
  if (!transaction || typeof transaction !== 'object') return null;
  const amount = positiveNumber(transaction.amount);
  if (!amount || !isValidDateKey(transaction.date)) return null;

  const type = transaction.type == null
    ? 'expense'
    : TRANSACTION_TYPES.has(transaction.type) ? transaction.type : null;
  if (!type) return null;

  const category = cleanText(transaction.category, type === 'expense' || type === 'refund' ? 'other' : type, 120);
  const legacyClass = transaction.expenseClass === 'spending' ? 'variable' : transaction.expenseClass;
  const expenseClass = type === 'expense'
    ? legacyClass === 'fixed' || legacyClass === 'variable'
      ? legacyClass
      : categoryDefaultClass(category, customCategories)
    : undefined;
  const assignmentMissing = type === 'expense' && (!transaction.paidBy || !transaction.account);

  return {
    id: cleanText(transaction.id, createId('txn'), 160),
    type,
    amount,
    category,
    date: transaction.date,
    desc: cleanText(transaction.desc, category, 160),
    ...(expenseClass ? { expenseClass } : {}),
    paid: type === 'expense' ? (typeof transaction.paid === 'boolean' ? transaction.paid : true) : true,
    paidBy: cleanText(transaction.paidBy, type === 'expense' ? 'unassigned' : '', 120),
    account: cleanText(transaction.account, type === 'expense' ? 'unassigned' : '', 120),
    needsConfirmation: Boolean(transaction.needsConfirmation || assignmentMissing),
    ...(transaction.isBillPayment ? { isBillPayment: true } : {}),
    ...(transaction.legacyRefund ? { legacyRefund: true } : {}),
  };
}

export function normaliseIncomeRecord(record, monthKey) {
  if (!record || typeof record !== 'object') return null;
  const amount = positiveNumber(record.amount);
  if (!amount || !isValidMonthKey(monthKey)) return null;
  const dateProvided = isValidDateKey(record.date);
  const date = dateProvided ? record.date : `${monthKey}-01`;
  const description = cleanText(record.description ?? record.label, '', 120);
  if (!description) return null;
  const receivedBy = cleanText(record.receivedBy, 'unassigned', 120);
  const account = cleanText(record.account, 'unassigned', 120);
  const incomeType = cleanText(record.incomeType ?? record.type ?? record.label, 'Other income', 80);
  return {
    id: cleanText(record.id, createId('income'), 160),
    date,
    amount,
    description,
    incomeType,
    receivedBy,
    account,
    needsConfirmation: Boolean(record.needsConfirmation || !dateProvided || receivedBy === 'unassigned' || account === 'unassigned'),
  };
}

function normaliseTransactionsByMonth(value, customCategories) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const grouped = {};
  Object.values(value).forEach((rows) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      const transaction = normaliseTransaction(row, customCategories);
      if (!transaction) return;
      const targetMonthKey = transaction.date.slice(0, 7);
      grouped[targetMonthKey] ||= [];
      grouped[targetMonthKey].push(transaction);
    });
  });
  return Object.fromEntries(Object.entries(grouped).map(([monthKey, rows]) => [
    monthKey,
    uniqueById(rows).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))),
  ]));
}

function normaliseIncomeByMonth(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([monthKey, rows]) => isValidMonthKey(monthKey) && Array.isArray(rows))
      .map(([monthKey, rows]) => [monthKey, uniqueById(rows.map((row) => normaliseIncomeRecord(row, monthKey)).filter(Boolean))])
      .filter(([, rows]) => rows.length),
  );
}

function normaliseLegacyMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (!key) return [];
    if (typeof item === 'object' && item && !Array.isArray(item)) return [[key, { ...item }]];
    return [];
  }));
}

function latestDataMonth(txnsByMonth, incomeByMonth, fallbackMonth) {
  const keys = [...new Set([...Object.keys(txnsByMonth), ...Object.keys(incomeByMonth)])]
    .filter(isValidMonthKey)
    .sort();
  return keys.at(-1) || fallbackMonth;
}

export function createBlankState() {
  return {
    version: CURRENT_STATE_VERSION,
    txnsByMonth: {},
    incomeByMonth: {},
    customCats: [],
    hiddenCats: [],
    people: [],
    accounts: [],
    savingsByMonth: {},
    monthMetaByMonth: {},
    savingsGoal: 0,
    savingsContrib: 0,
    budgetsByMonth: {},
    dueDays: {},
  };
}

export function migrateState(saved, now = new Date()) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return createBlankState();
  const currentKey = mkKey(now.getFullYear(), now.getMonth());
  const customCats = normaliseCustomCategories(saved.customCats);
  const txnsByMonth = normaliseTransactionsByMonth(saved.txnsByMonth, customCats);

  let incomeByMonth = normaliseIncomeByMonth(saved.incomeByMonth);
  if (!Object.keys(incomeByMonth).length && Array.isArray(saved.sources)) {
    const migrated = saved.sources.map((source) => normaliseIncomeRecord(source, currentKey)).filter(Boolean);
    if (migrated.length) incomeByMonth = { [currentKey]: migrated };
  }

  let savingsByMonth = normaliseSavingsByMonth(saved.savingsByMonth);
  if (!Object.keys(savingsByMonth).length) {
    let legacyAccounts = normaliseSavingsAccounts(saved.savingsAccounts);
    const legacySavings = positiveNumber(saved.savingsBal);
    if (!legacyAccounts.length && legacySavings) {
      legacyAccounts = [{ id: 'legacy_savings', label: 'Savings', balance: legacySavings }];
    }
    if (legacyAccounts.length) {
      const targetMonth = latestDataMonth(txnsByMonth, incomeByMonth, currentKey);
      savingsByMonth = { [targetMonth]: legacyAccounts };
    }
  }

  return {
    version: CURRENT_STATE_VERSION,
    txnsByMonth,
    incomeByMonth,
    customCats,
    hiddenCats: Array.isArray(saved.hiddenCats)
      ? [...new Set(saved.hiddenCats.filter((id) => typeof id === 'string').map((id) => id.slice(0, 120)))]
      : [],
    people: normaliseReferenceList(saved.people, 'person'),
    accounts: normaliseReferenceList(saved.accounts, 'account'),
    savingsByMonth,
    monthMetaByMonth: normaliseMonthMetaByMonth(saved.monthMetaByMonth),
    savingsGoal: positiveNumber(saved.savingsGoal),
    savingsContrib: positiveNumber(saved.savingsContrib),
    budgetsByMonth: normaliseLegacyMap(saved.budgetsByMonth),
    dueDays: saved.dueDays && typeof saved.dueDays === 'object' && !Array.isArray(saved.dueDays) ? { ...saved.dueDays } : {},
  };
}

export function currentSavingsTotal(state, monthKey) {
  if (!isValidMonthKey(monthKey)) return 0;
  return (state?.savingsByMonth?.[monthKey] || []).reduce((sum, account) => sum + nonNegativeNumber(account.balance), 0);
}

function isIncompleteExpense(transaction) {
  return transaction.type === 'expense' && (
    transaction.paidBy === 'unassigned'
    || transaction.account === 'unassigned'
    || transaction.needsConfirmation
  );
}

function isIncompleteIncome(record) {
  return record.receivedBy === 'unassigned' || record.account === 'unassigned' || record.needsConfirmation;
}

export function monthSummary(state, monthKey) {
  const incomeRecords = state?.incomeByMonth?.[monthKey] || [];
  const transactions = state?.txnsByMonth?.[monthKey] || [];
  const expenseTransactions = transactions.filter((transaction) => transaction.type === 'expense');
  const income = incomeRecords.reduce((sum, record) => sum + positiveNumber(record.amount), 0);
  const expenses = expenseTransactions.reduce((sum, transaction) => sum + positiveNumber(transaction.amount), 0);
  const paidExpenses = expenseTransactions.filter((transaction) => transaction.paid).reduce((sum, transaction) => sum + positiveNumber(transaction.amount), 0);
  const remainingBills = expenseTransactions.filter((transaction) => !transaction.paid).reduce((sum, transaction) => sum + positiveNumber(transaction.amount), 0);
  const fixedExpenses = expenseTransactions.filter((transaction) => transaction.expenseClass === 'fixed').reduce((sum, transaction) => sum + positiveNumber(transaction.amount), 0);
  const variableExpenses = expenses - fixedExpenses;
  const excludedMovements = transactions
    .filter((transaction) => ['internal_transfer','savings_transfer','card_repayment'].includes(transaction.type))
    .reduce((sum, transaction) => sum + positiveNumber(transaction.amount), 0);
  const legacyRefunds = transactions
    .filter((transaction) => transaction.type === 'refund')
    .reduce((sum, transaction) => sum + positiveNumber(transaction.amount), 0);
  const currentSavings = currentSavingsTotal(state, monthKey);
  const savedThisMonth = income - expenses;
  const monthMeta = state?.monthMetaByMonth?.[monthKey] || {};
  const isComplete = monthMeta.status === 'complete';
  const startingSavings = isComplete ? nonNegativeNumber(monthMeta.startingSavings) : 0;
  const expectedClosingSavings = isComplete ? startingSavings + income - expenses : null;
  const closingVariance = isComplete ? currentSavings - expectedClosingSavings : null;
  const freeSavingsAfterBills = currentSavings - remainingBills;
  const projectedIncrease = isComplete ? savedThisMonth : income - remainingBills;
  const projectedEndSavings = isComplete
    ? currentSavings - remainingBills
    : currentSavings + income - remainingBills;

  const plan = new Map();
  expenseTransactions.filter((transaction) => !transaction.paid).forEach((transaction) => {
    const paidBy = transaction.paidBy || 'unassigned';
    const account = transaction.account || 'unassigned';
    const key = `${paidBy}::${account}`;
    const current = plan.get(key) || { key, paidBy, account, amount: 0, count: 0 };
    current.amount += positiveNumber(transaction.amount);
    current.count += 1;
    plan.set(key, current);
  });

  const transferPlan = [...plan.values()].sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
  const incompleteExpenses = expenseTransactions.filter(isIncompleteExpense).length;
  const incompleteIncome = incomeRecords.filter(isIncompleteIncome).length;
  const hasSavingsSnapshot = Boolean(state?.savingsByMonth?.[monthKey]?.length);

  return {
    incomeRecords,
    transactions,
    expenseTransactions,
    income,
    expenses,
    paidExpenses,
    remainingBills,
    fixedExpenses,
    variableExpenses,
    excludedMovements,
    legacyRefunds,
    currentSavings,
    hasSavingsSnapshot,
    savedThisMonth,
    freeSavingsAfterBills,
    projectedIncrease,
    projectedEndSavings,
    transferPlan,
    incompleteExpenses,
    incompleteIncome,
    incompleteRecords: incompleteExpenses + incompleteIncome,
    monthMeta,
    isComplete,
    startingSavings,
    expectedClosingSavings,
    closingVariance,
    hasData: incomeRecords.length > 0 || transactions.length > 0 || hasSavingsSnapshot || isComplete,
  };
}

export function annualSummary(state, year) {
  const months = Array.from({ length: 12 }, (_, month) => ({
    key: mkKey(year, month),
    month,
    ...monthSummary(state, mkKey(year, month)),
  }));
  const withData = months.filter((item) => item.incomeRecords.length || item.transactions.length);
  const fields = ['income','expenses','paidExpenses','remainingBills','fixedExpenses','variableExpenses','excludedMovements','savedThisMonth'];
  const totals = Object.fromEntries(fields.map((field) => [field, withData.reduce((sum, item) => sum + item[field], 0)]));
  return { months, withData, ...totals };
}
