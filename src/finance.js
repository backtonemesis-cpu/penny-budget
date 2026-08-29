import { BASE_CATEGORIES, SPECIAL_ACCOUNTS, SPECIAL_PEOPLE } from './catalog.js';

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const TRANSACTION_TYPES = new Set(['expense','internal_transfer','savings_transfer','card_repayment','refund']);
export const CONFIRMATION_ISSUES = new Set(['date','paidBy','account','receivedBy','other']);
export const CURRENT_STATE_VERSION = 7;
export const MAX_AUDIT_ENTRIES = 1000;

const BASE_CATEGORY_MAP = Object.fromEntries(BASE_CATEGORIES.map((category) => [category.id, category]));
const SPECIAL_PERSON_MAP = Object.fromEntries(SPECIAL_PEOPLE.map((item) => [item.id, item.label]));
const SPECIAL_ACCOUNT_MAP = Object.fromEntries(SPECIAL_ACCOUNTS.map((item) => [item.id, item.label]));

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

export function roundMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

export function positiveNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? roundMoney(parsed) : 0;
}

export function signedNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

export function nonNegativeNumber(value) {
  return Math.max(0, signedNumber(value));
}

export function sumMoney(values) {
  return roundMoney(values.reduce((sum, value) => sum + signedNumber(value), 0));
}

export function formatMoney(value, { plus = false, decimals = 2 } = {}) {
  const number = roundMoney(value);
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
      const rawInput = meta.startingSavings;
      const startingSavingsProvided = (
        typeof rawInput === 'number'
        || (typeof rawInput === 'string' && rawInput.trim() !== '')
      ) && Number.isFinite(Number(rawInput)) && Number(rawInput) >= 0;
      const rawStartingSavings = startingSavingsProvided ? Number(rawInput) : 0;
      return [[monthKey, {
        status: 'complete',
        startingSavings: startingSavingsProvided ? nonNegativeNumber(rawStartingSavings) : 0,
        startingSavingsConfirmed: Boolean(startingSavingsProvided && meta.startingSavingsConfirmed !== false),
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

function normaliseConfirmationIssues(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((issue) => CONFIRMATION_ISSUES.has(issue)))];
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
  const paidBy = cleanText(transaction.paidBy, type === 'expense' ? 'unassigned' : '', 120);
  const accountRequired = type === 'expense' || ['internal_transfer','savings_transfer','card_repayment'].includes(type);
  const account = cleanText(transaction.account, accountRequired ? 'unassigned' : '', 120);
  const explicitIssues = Array.isArray(transaction.confirmationIssues);
  const issueSet = new Set(normaliseConfirmationIssues(transaction.confirmationIssues));
  if (!explicitIssues && transaction.needsConfirmation) issueSet.add('date');
  if (transaction.dateConfirmed === false) issueSet.add('date');
  if (type === 'expense' && paidBy === 'unassigned') issueSet.add('paidBy');
  else issueSet.delete('paidBy');
  if (accountRequired && account === 'unassigned') issueSet.add('account');
  else if (accountRequired) issueSet.delete('account');
  const confirmationIssues = [...issueSet];

  return {
    id: cleanText(transaction.id, createId('txn'), 160),
    type,
    amount,
    category,
    date: transaction.date,
    desc: cleanText(transaction.desc, category, 160),
    ...(expenseClass ? { expenseClass } : {}),
    paid: type === 'expense' ? (typeof transaction.paid === 'boolean' ? transaction.paid : false) : true,
    paidBy,
    account,
    paidByLabel: cleanText(transaction.paidByLabel, '', 80),
    accountLabel: cleanText(transaction.accountLabel, '', 80),
    confirmationIssues,
    dateConfirmed: !confirmationIssues.includes('date'),
    needsConfirmation: confirmationIssues.length > 0,
    source: cleanText(transaction.source, 'legacy', 32),
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
  const explicitIssues = Array.isArray(record.confirmationIssues);
  const issueSet = new Set(normaliseConfirmationIssues(record.confirmationIssues));
  if (!dateProvided || record.dateConfirmed === false || (!explicitIssues && record.needsConfirmation)) issueSet.add('date');
  if (receivedBy === 'unassigned') issueSet.add('receivedBy');
  else issueSet.delete('receivedBy');
  if (account === 'unassigned') issueSet.add('account');
  else issueSet.delete('account');
  const confirmationIssues = [...issueSet];
  return {
    id: cleanText(record.id, createId('income'), 160),
    date,
    amount,
    description,
    incomeType,
    receivedBy,
    account,
    receivedByLabel: cleanText(record.receivedByLabel, '', 80),
    accountLabel: cleanText(record.accountLabel, '', 80),
    confirmationIssues,
    dateConfirmed: !confirmationIssues.includes('date'),
    needsConfirmation: confirmationIssues.length > 0,
    source: cleanText(record.source, 'legacy', 32),
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

function normaliseAuditLog(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_AUDIT_ENTRIES).flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const id = cleanText(entry.id, '', 160);
    const at = cleanText(entry.at, '', 40);
    const action = cleanText(entry.action, '', 60);
    if (!id || !at || !action) return [];
    return [{
      id,
      at,
      action,
      entityType: cleanText(entry.entityType, 'state', 40),
      entityId: cleanText(entry.entityId, '', 160),
      monthKey: isValidMonthKey(entry.monthKey) ? entry.monthKey : '',
      label: cleanText(entry.label, action, 160),
      before: entry.before && typeof entry.before === 'object' ? entry.before : null,
      after: entry.after && typeof entry.after === 'object' ? entry.after : null,
    }];
  });
}

function snapshotReferenceLabels(txnsByMonth, incomeByMonth, people, accounts) {
  const personMap = { ...SPECIAL_PERSON_MAP, ...Object.fromEntries(people.map((item) => [item.id, item.label])) };
  const accountMap = { ...SPECIAL_ACCOUNT_MAP, ...Object.fromEntries(accounts.map((item) => [item.id, item.label])) };
  const nextTxns = Object.fromEntries(Object.entries(txnsByMonth).map(([monthKey, rows]) => [monthKey, rows.map((row) => ({
    ...row,
    paidByLabel: row.paidByLabel || personMap[row.paidBy] || row.paidBy || '',
    accountLabel: row.accountLabel || accountMap[row.account] || row.account || '',
  }))]));
  const nextIncome = Object.fromEntries(Object.entries(incomeByMonth).map(([monthKey, rows]) => [monthKey, rows.map((row) => ({
    ...row,
    receivedByLabel: row.receivedByLabel || personMap[row.receivedBy] || row.receivedBy || '',
    accountLabel: row.accountLabel || accountMap[row.account] || row.account || '',
  }))]));
  return { txnsByMonth: nextTxns, incomeByMonth: nextIncome };
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
    auditLog: [],
  };
}

export function migrateState(saved, now = new Date()) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return createBlankState();
  const currentKey = mkKey(now.getFullYear(), now.getMonth());
  const customCats = normaliseCustomCategories(saved.customCats);
  let txnsByMonth = normaliseTransactionsByMonth(saved.txnsByMonth, customCats);

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

  const people = normaliseReferenceList(saved.people, 'person');
  const accounts = normaliseReferenceList(saved.accounts, 'account');
  ({ txnsByMonth, incomeByMonth } = snapshotReferenceLabels(txnsByMonth, incomeByMonth, people, accounts));

  return {
    version: CURRENT_STATE_VERSION,
    txnsByMonth,
    incomeByMonth,
    customCats,
    hiddenCats: Array.isArray(saved.hiddenCats)
      ? [...new Set(saved.hiddenCats.filter((id) => typeof id === 'string').map((id) => id.slice(0, 120)))]
      : [],
    people,
    accounts,
    savingsByMonth,
    monthMetaByMonth: normaliseMonthMetaByMonth(saved.monthMetaByMonth),
    savingsGoal: positiveNumber(saved.savingsGoal),
    savingsContrib: positiveNumber(saved.savingsContrib),
    budgetsByMonth: normaliseLegacyMap(saved.budgetsByMonth),
    dueDays: saved.dueDays && typeof saved.dueDays === 'object' && !Array.isArray(saved.dueDays) ? { ...saved.dueDays } : {},
    auditLog: normaliseAuditLog(saved.auditLog),
  };
}

export function currentSavingsTotal(state, monthKey) {
  if (!isValidMonthKey(monthKey)) return 0;
  return sumMoney((state?.savingsByMonth?.[monthKey] || []).map((account) => nonNegativeNumber(account.balance)));
}

function isIncompleteExpense(transaction) {
  return transaction.type === 'expense' && Boolean(transaction.needsConfirmation || transaction.confirmationIssues?.length);
}

function isIncompleteIncome(record) {
  return Boolean(record.needsConfirmation || record.confirmationIssues?.length);
}

function isIncompleteMovement(transaction) {
  return ['internal_transfer','savings_transfer','card_repayment'].includes(transaction.type)
    && Boolean(transaction.needsConfirmation || transaction.confirmationIssues?.length);
}

export function monthSummary(state, monthKey) {
  const incomeRecords = state?.incomeByMonth?.[monthKey] || [];
  const transactions = state?.txnsByMonth?.[monthKey] || [];
  const expenseTransactions = transactions.filter((transaction) => transaction.type === 'expense');
  const income = sumMoney(incomeRecords.map((record) => record.amount));
  const expenses = sumMoney(expenseTransactions.map((transaction) => transaction.amount));
  const paidExpenses = sumMoney(expenseTransactions.filter((transaction) => transaction.paid).map((transaction) => transaction.amount));
  const remainingBills = sumMoney(expenseTransactions.filter((transaction) => !transaction.paid).map((transaction) => transaction.amount));
  const fixedExpenses = sumMoney(expenseTransactions.filter((transaction) => transaction.expenseClass === 'fixed').map((transaction) => transaction.amount));
  const variableExpenses = roundMoney(expenses - fixedExpenses);
  const excludedMovements = sumMoney(transactions
    .filter((transaction) => ['internal_transfer','savings_transfer','card_repayment'].includes(transaction.type))
    .map((transaction) => transaction.amount));
  const legacyRefunds = sumMoney(transactions.filter((transaction) => transaction.type === 'refund').map((transaction) => transaction.amount));
  const currentSavings = currentSavingsTotal(state, monthKey);
  const savedThisMonth = roundMoney(income - expenses);
  const monthMeta = state?.monthMetaByMonth?.[monthKey] || {};
  const isComplete = monthMeta.status === 'complete';
  const rawStartingSavings = monthMeta.startingSavings;
  const hasStartingSavingsValue = Object.hasOwn(monthMeta, 'startingSavings')
    && (typeof rawStartingSavings === 'number' || (typeof rawStartingSavings === 'string' && rawStartingSavings.trim() !== ''))
    && Number.isFinite(Number(rawStartingSavings))
    && Number(rawStartingSavings) >= 0;
  const startingSavingsConfirmed = Boolean(isComplete && hasStartingSavingsValue && monthMeta.startingSavingsConfirmed !== false);
  const startingSavings = startingSavingsConfirmed ? nonNegativeNumber(rawStartingSavings) : 0;
  const expectedClosingSavings = startingSavingsConfirmed ? roundMoney(startingSavings + income - expenses) : null;
  const closingVariance = startingSavingsConfirmed ? roundMoney(currentSavings - expectedClosingSavings) : null;
  const freeSavingsAfterBills = roundMoney(currentSavings - remainingBills);
  const projectedIncrease = isComplete ? 0 : savedThisMonth;
  const projectedEndSavings = isComplete ? currentSavings : roundMoney(currentSavings + savedThisMonth);

  const plan = new Map();
  expenseTransactions.filter((transaction) => !transaction.paid).forEach((transaction) => {
    const paidBy = transaction.paidBy || 'unassigned';
    const account = transaction.account || 'unassigned';
    const key = `${paidBy}::${account}`;
    const current = plan.get(key) || {
      key,
      paidBy,
      account,
      paidByLabel: transaction.paidByLabel,
      accountLabel: transaction.accountLabel,
      amount: 0,
      count: 0,
    };
    current.amount = roundMoney(current.amount + positiveNumber(transaction.amount));
    current.count += 1;
    plan.set(key, current);
  });

  const transferPlan = [...plan.values()].sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
  const incompleteExpenses = expenseTransactions.filter(isIncompleteExpense).length;
  const incompleteIncome = incomeRecords.filter(isIncompleteIncome).length;
  const incompleteMovements = transactions.filter(isIncompleteMovement).length;
  const incompleteRecords = incompleteExpenses + incompleteIncome + incompleteMovements;
  const hasSavingsSnapshot = Boolean(state?.savingsByMonth?.[monthKey]?.length);
  const reconciliationProblem = Boolean(isComplete && startingSavingsConfirmed && (Math.abs(closingVariance || 0) >= 0.005 || remainingBills > 0));
  const auditReady = Boolean(isComplete && startingSavingsConfirmed && incompleteRecords === 0 && !reconciliationProblem && hasSavingsSnapshot);
  const evidenceStatus = !isComplete ? (incomeRecords.length || transactions.length || hasSavingsSnapshot ? 'in_progress' : 'empty') : (auditReady ? 'ready' : 'review');

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
    incompleteMovements,
    incompleteRecords,
    monthMeta,
    isComplete,
    startingSavings,
    startingSavingsConfirmed,
    expectedClosingSavings,
    closingVariance,
    reconciliationProblem,
    auditReady,
    evidenceStatus,
    hasData: incomeRecords.length > 0 || transactions.length > 0 || hasSavingsSnapshot || isComplete,
  };
}

export function annualSummary(state, year) {
  const months = Array.from({ length: 12 }, (_, month) => ({
    key: mkKey(year, month),
    month,
    ...monthSummary(state, mkKey(year, month)),
  }));
  const withData = months.filter((item) => item.hasData);
  const fields = ['income','expenses','paidExpenses','remainingBills','fixedExpenses','variableExpenses','excludedMovements','savedThisMonth'];
  const totals = Object.fromEntries(fields.map((field) => [field, sumMoney(withData.map((item) => item[field]))]));
  const incompleteRecords = withData.reduce((sum, item) => sum + item.incompleteRecords, 0);
  const monthsInProgress = withData.filter((item) => !item.isComplete).length;
  const monthsNeedingReview = withData.filter((item) => item.isComplete && !item.auditReady).length;
  const unreconciledMonths = withData.filter((item) => item.reconciliationProblem).length;
  const auditReady = Boolean(withData.length && monthsInProgress === 0 && monthsNeedingReview === 0 && incompleteRecords === 0 && unreconciledMonths === 0);
  const evidenceStatus = !withData.length ? 'empty' : auditReady ? 'ready' : monthsInProgress > 0 ? 'in_progress' : 'review';
  return {
    months,
    withData,
    ...totals,
    incompleteRecords,
    monthsInProgress,
    monthsNeedingReview,
    unreconciledMonths,
    auditReady,
    evidenceStatus,
  };
}

function compareText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isLikelyDuplicateTransaction(existing, candidate) {
  if (!existing || !candidate || existing.id === candidate.id) return false;
  return existing.type === candidate.type
    && roundMoney(existing.amount) === roundMoney(candidate.amount)
    && existing.date === candidate.date
    && compareText(existing.desc) === compareText(candidate.desc)
    && compareText(existing.category) === compareText(candidate.category)
    && compareText(existing.paidBy) === compareText(candidate.paidBy)
    && compareText(existing.account) === compareText(candidate.account);
}

export function isLikelyDuplicateIncome(existing, candidate) {
  if (!existing || !candidate || existing.id === candidate.id) return false;
  return roundMoney(existing.amount) === roundMoney(candidate.amount)
    && existing.date === candidate.date
    && compareText(existing.description) === compareText(candidate.description)
    && compareText(existing.incomeType) === compareText(candidate.incomeType)
    && compareText(existing.receivedBy) === compareText(candidate.receivedBy)
    && compareText(existing.account) === compareText(candidate.account);
}
