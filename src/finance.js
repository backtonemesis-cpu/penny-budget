import { isFixedBillCategory } from './catalog.js';

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const TRANSACTION_TYPES = new Set(['expense','refund','internal_transfer','savings_transfer','card_repayment']);

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

export function createBlankState() {
  return {
    version: 3,
    txnsByMonth: {},
    incomeByMonth: {},
    budgetsByMonth: {},
    customCats: [],
    hiddenCats: [],
    dueDays: {},
    savingsGoal: 0,
    savingsBal: 0,
    savingsContrib: 0,
  };
}

export function createId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function positiveNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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
  if (!isValidDateKey(value)) return value || 'Unknown date';
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

function normaliseIncomeSource(source) {
  const amount = positiveNumber(source?.amount);
  const label = cleanText(source?.label, '', 80);
  if (!amount || !label) return null;
  return {
    id: cleanText(source?.id, createId('income'), 120),
    label,
    amount,
  };
}

function normaliseCustomCategories(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((category) => {
    const id = cleanText(category?.id, '', 120);
    const label = cleanText(category?.label, '', 80);
    if (!id || !label || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      label,
      icon: cleanText(category?.icon, '🏷️', 8),
      group: cleanText(category?.group, 'Other', 40),
      bill: Boolean(category?.bill),
      budgetable: category?.budgetable !== false,
      fixed: false,
    }];
  });
}

export function normaliseTransaction(transaction, fixedCategoryIds = new Set()) {
  if (!transaction || typeof transaction !== 'object') return null;
  const amount = positiveNumber(transaction.amount);
  if (!amount || !isValidDateKey(transaction.date)) return null;

  const type = transaction.type == null
    ? 'expense'
    : TRANSACTION_TYPES.has(transaction.type) ? transaction.type : null;
  if (!type) return null;

  const category = cleanText(transaction.category, type === 'expense' || type === 'refund' ? 'other' : type, 120);
  const expenseClass = type === 'expense'
    ? transaction.expenseClass === 'fixed' || isFixedBillCategory(category) || fixedCategoryIds.has(category)
      ? 'fixed'
      : 'spending'
    : undefined;

  return {
    id: cleanText(transaction.id, createId('txn'), 160),
    type,
    amount,
    category,
    date: transaction.date,
    desc: cleanText(transaction.desc, category, 160),
    ...(expenseClass ? { expenseClass } : {}),
    ...(transaction.isBillPayment ? { isBillPayment: true } : {}),
  };
}

function normaliseIncomeByMonth(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([monthKey, rows]) => isValidMonthKey(monthKey) && Array.isArray(rows))
      .map(([monthKey, rows]) => [monthKey, rows.map(normaliseIncomeSource).filter(Boolean)])
      .filter(([, rows]) => rows.length > 0),
  );
}

function normaliseTransactionsByMonth(value, fixedCategoryIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const grouped = {};
  Object.values(value).forEach((rows) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      const transaction = normaliseTransaction(row, fixedCategoryIds);
      if (!transaction) return;
      const targetMonthKey = transaction.date.slice(0, 7);
      grouped[targetMonthKey] ||= [];
      grouped[targetMonthKey].push(transaction);
    });
  });
  return Object.fromEntries(
    Object.entries(grouped).map(([monthKey, rows]) => [
      monthKey,
      rows
        .filter((transaction, index, all) => all.findIndex((candidate) => candidate.id === transaction.id) === index)
        .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))),
    ]),
  );
}

function normaliseBudgetMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([categoryId, amount]) => [cleanText(categoryId, '', 120), positiveNumber(amount)])
      .filter(([categoryId, amount]) => categoryId && amount > 0),
  );
}

function normaliseBudgetsByMonth(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([monthKey]) => isValidMonthKey(monthKey))
      .map(([monthKey, budgets]) => [monthKey, normaliseBudgetMap(budgets)])
      .filter(([, budgets]) => Object.keys(budgets).length > 0),
  );
}

export function migrateState(saved, now = new Date()) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return createBlankState();
  const currentKey = mkKey(now.getFullYear(), now.getMonth());
  const customCats = normaliseCustomCategories(saved.customCats);
  const customBillIds = new Set(customCats.filter((category) => category.bill).map((category) => category.id));
  const txnsByMonth = normaliseTransactionsByMonth(saved.txnsByMonth, customBillIds);

  let incomeByMonth = normaliseIncomeByMonth(saved.incomeByMonth);
  if (!saved.incomeByMonth && Array.isArray(saved.sources)) {
    const legacySources = saved.sources.map(normaliseIncomeSource).filter(Boolean);
    if (legacySources.length) {
      const relevantMonths = new Set([...Object.keys(txnsByMonth), currentKey]);
      incomeByMonth = Object.fromEntries([...relevantMonths].map((monthKey) => [monthKey, legacySources.map((source) => ({ ...source }))]));
    }
  }

  let budgetsByMonth = normaliseBudgetsByMonth(saved.budgetsByMonth);
  if (!saved.budgetsByMonth && saved.budgets) {
    const migratedBudgets = normaliseBudgetMap(saved.budgets);
    if (Object.keys(migratedBudgets).length) budgetsByMonth = { [currentKey]: migratedBudgets };
  }

  const dueDays = saved.dueDays && typeof saved.dueDays === 'object' && !Array.isArray(saved.dueDays)
    ? Object.fromEntries(
      Object.entries(saved.dueDays)
        .map(([categoryId, day]) => [cleanText(categoryId, '', 120), Number(day)])
        .filter(([categoryId, day]) => categoryId && Number.isInteger(day) && day >= 1 && day <= 31),
    )
    : {};

  return {
    version: 3,
    txnsByMonth,
    incomeByMonth,
    budgetsByMonth,
    customCats,
    hiddenCats: Array.isArray(saved.hiddenCats)
      ? [...new Set(saved.hiddenCats.filter((id) => typeof id === 'string').map((id) => id.slice(0, 120)))]
      : [],
    dueDays,
    savingsGoal: positiveNumber(saved.savingsGoal),
    savingsBal: positiveNumber(saved.savingsBal),
    savingsContrib: positiveNumber(saved.savingsContrib),
  };
}

export function getMonthBudgets(state, monthKey) {
  return state?.budgetsByMonth?.[monthKey] || {};
}

export function monthSummary(state, monthKey) {
  const incomeSources = state?.incomeByMonth?.[monthKey] || [];
  const transactions = state?.txnsByMonth?.[monthKey] || [];
  const income = incomeSources.reduce((sum, source) => sum + positiveNumber(source.amount), 0);
  const customBillIds = new Set((state?.customCats || []).filter((category) => category.bill).map((category) => category.id));

  let fixedBills = 0;
  let grossSpending = 0;
  let refunds = 0;
  let internalTransfers = 0;
  let savingsTransfers = 0;
  let cardRepayments = 0;

  transactions.forEach((transaction) => {
    const amount = positiveNumber(transaction.amount);
    if (transaction.type === 'refund') refunds += amount;
    else if (transaction.type === 'internal_transfer') internalTransfers += amount;
    else if (transaction.type === 'savings_transfer') savingsTransfers += amount;
    else if (transaction.type === 'card_repayment') cardRepayments += amount;
    else if (transaction.expenseClass === 'fixed' || isFixedBillCategory(transaction.category) || customBillIds.has(transaction.category)) fixedBills += amount;
    else grossSpending += amount;
  });

  const expenses = fixedBills + grossSpending;
  return {
    incomeSources,
    transactions,
    income,
    fixedBills,
    grossSpending,
    expenses,
    refunds,
    internalTransfers,
    savingsTransfers,
    cardRepayments,
    excludedTransfers: internalTransfers + savingsTransfers + cardRepayments,
    available: income + refunds - fixedBills - grossSpending,
    hasData: incomeSources.length > 0 || transactions.length > 0,
  };
}

export function annualSummary(state, year) {
  const months = Array.from({ length: 12 }, (_, month) => ({
    key: mkKey(year, month),
    month,
    ...monthSummary(state, mkKey(year, month)),
  }));
  const withData = months.filter((item) => item.hasData);
  const fields = ['income','fixedBills','grossSpending','expenses','refunds','internalTransfers','savingsTransfers','cardRepayments','excludedTransfers'];
  const totals = Object.fromEntries(fields.map((field) => [field, withData.reduce((sum, item) => sum + item[field], 0)]));
  return {
    months,
    withData,
    ...totals,
    available: totals.income + totals.refunds - totals.fixedBills - totals.grossSpending,
  };
}

export function dueStatus(year, month, day, paid, now = new Date(), partial = false) {
  if (paid) return { label: 'Paid', tone: 'green' };
  const numericDay = Number(day);
  if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) {
    return partial
      ? { label: 'Part paid · set due date', tone: 'amber' }
      : { label: 'Set due date', tone: 'neutral' };
  }

  const safeDay = Math.min(numericDay, new Date(year, month + 1, 0).getDate());
  const due = new Date(year, month, safeDay);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((due - today) / 86400000);

  if (diff < 0) return { label: partial ? 'Part paid · overdue' : 'Overdue', tone: 'red' };
  if (diff === 0) return { label: partial ? 'Part paid · due today' : 'Due today', tone: 'red' };
  if (diff === 1) return { label: partial ? 'Part paid · due tomorrow' : 'Due tomorrow', tone: 'amber' };
  if (partial) return { label: 'Part paid', tone: 'amber' };
  if (year === now.getFullYear() && month === now.getMonth()) return { label: `Due in ${diff} days`, tone: diff <= 3 ? 'red' : 'amber' };
  return { label: `Due day ${safeDay}`, tone: 'neutral' };
}
