export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function mkKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function createId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function positiveNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

export function formatMoney(value, { plus = false, decimals = 2 } = {}) {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : plus && number > 0 ? "+" : "";
  return `${sign}£${Math.abs(number).toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function monthSummary(state, monthKey) {
  const incomeSources = state.incomeByMonth?.[monthKey] || [];
  const transactions = state.txnsByMonth?.[monthKey] || [];
  const income = incomeSources.reduce((sum, source) => sum + (Number(source.amount) || 0), 0);
  const expenses = transactions
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0);
  const refunds = transactions
    .filter((txn) => txn.type === "refund")
    .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0);
  return {
    incomeSources,
    transactions,
    income,
    expenses,
    refunds,
    available: income + refunds - expenses,
    hasData: incomeSources.length > 0 || transactions.length > 0,
  };
}

export function annualSummary(state, year) {
  const months = Array.from({ length: 12 }, (_, month) => {
    const key = mkKey(year, month);
    return { key, month, ...monthSummary(state, key) };
  });
  const withData = months.filter((item) => item.hasData);
  const income = withData.reduce((sum, item) => sum + item.income, 0);
  const expenses = withData.reduce((sum, item) => sum + item.expenses, 0);
  const refunds = withData.reduce((sum, item) => sum + item.refunds, 0);
  return { months, withData, income, expenses, refunds, available: income + refunds - expenses };
}

function copySources(sources = []) {
  return sources.map((source) => ({
    ...source,
    id: source.id || createId("income"),
    amount: positiveNumber(source.amount),
  }));
}

export function migrateState(saved, now = new Date()) {
  const currentKey = mkKey(now.getFullYear(), now.getMonth());
  const txnsByMonth = saved?.txnsByMonth && typeof saved.txnsByMonth === "object" ? saved.txnsByMonth : {};
  let incomeByMonth = saved?.incomeByMonth && typeof saved.incomeByMonth === "object" ? saved.incomeByMonth : null;

  if (!incomeByMonth) {
    incomeByMonth = {};
    const legacySources = Array.isArray(saved?.sources) ? saved.sources : [];
    const keys = new Set([...Object.keys(txnsByMonth), currentKey]);
    keys.forEach((key) => { incomeByMonth[key] = copySources(legacySources); });
  }

  const normalisedTransactions = Object.fromEntries(
    Object.entries(txnsByMonth).map(([key, rows]) => [key, Array.isArray(rows) ? rows.map((txn) => ({
      ...txn,
      id: txn.id || createId("txn"),
      type: txn.type === "refund" ? "refund" : "expense",
      amount: positiveNumber(txn.amount),
    })) : []])
  );

  return {
    version: 2,
    txnsByMonth: normalisedTransactions,
    incomeByMonth: Object.fromEntries(
      Object.entries(incomeByMonth).map(([key, sources]) => [key, copySources(Array.isArray(sources) ? sources : [])])
    ),
    customCats: Array.isArray(saved?.customCats) ? saved.customCats : [],
    hiddenCats: Array.isArray(saved?.hiddenCats) ? saved.hiddenCats : [],
    budgets: saved?.budgets && typeof saved.budgets === "object" ? saved.budgets : {},
    dueDays: saved?.dueDays && typeof saved.dueDays === "object" ? saved.dueDays : {},
    savingsGoal: positiveNumber(saved?.savingsGoal ?? 25000),
    savingsBal: positiveNumber(saved?.savingsBal ?? 0),
    savingsContrib: positiveNumber(saved?.savingsContrib ?? 0),
  };
}

export function dueStatus(year, month, day, paid, now = new Date()) {
  if (paid) return { label: "paid", tone: "green" };
  const safeDay = Math.min(Math.max(Number(day) || 1, 1), new Date(year, month + 1, 0).getDate());
  const due = new Date(year, month, safeDay);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return { label: "overdue", tone: "red" };
  if (diff === 0) return { label: "due today", tone: "red" };
  if (diff === 1) return { label: "due tomorrow", tone: "amber" };
  if (year === now.getFullYear() && month === now.getMonth()) return { label: `due in ${diff} days`, tone: diff <= 3 ? "red" : "amber" };
  return { label: `due day ${safeDay}`, tone: "amber" };
}
