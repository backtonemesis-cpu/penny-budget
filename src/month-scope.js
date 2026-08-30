function validMonthKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

function cloneList(value) {
  return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
}

function cleanPeople(value) {
  const seen = new Set();
  return cloneList(value).filter((item) => {
    if (!item?.id || !item?.label || ['unassigned', 'household'].includes(item.id) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function cleanAccounts(value) {
  const seen = new Set();
  return cloneList(value).flatMap((item) => {
    if (!item?.id || !item?.label || item.id === 'unassigned' || seen.has(item.id)) return [];
    seen.add(item.id);
    return [{ ...item, ownerId: item.ownerId || 'unassigned' }];
  });
}

function cleanHidden(value) {
  return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string' && item))] : [];
}

function explicitMonthList(record, monthKey, cleaner) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || !Object.hasOwn(record, monthKey)) return null;
  return cleaner(record[monthKey]);
}

export function getMonthPeople(state, monthKey) {
  return explicitMonthList(state?.peopleByMonth, monthKey, cleanPeople) ?? cleanPeople(state?.people);
}

export function getMonthAccounts(state, monthKey) {
  return explicitMonthList(state?.accountsByMonth, monthKey, cleanAccounts) ?? cleanAccounts(state?.accounts);
}

export function getMonthHiddenCats(state, monthKey) {
  return explicitMonthList(state?.hiddenCatsByMonth, monthKey, cleanHidden) ?? cleanHidden(state?.hiddenCats);
}

export function knownMonthKeys(state, currentKey = '') {
  const keys = new Set(validMonthKey(currentKey) ? [currentKey] : []);
  for (const field of ['txnsByMonth', 'incomeByMonth', 'savingsByMonth', 'bankBalancesByMonth', 'monthMetaByMonth', 'budgetsByMonth', 'peopleByMonth', 'accountsByMonth', 'hiddenCatsByMonth']) {
    const record = state?.[field];
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    Object.keys(record).filter(validMonthKey).forEach((key) => keys.add(key));
  }
  return [...keys].sort();
}

function migrateMap(savedMap, keys, fallback, cleaner) {
  const source = savedMap && typeof savedMap === 'object' && !Array.isArray(savedMap) ? savedMap : null;
  const result = {};
  keys.forEach((key) => {
    if (source && Object.hasOwn(source, key)) result[key] = cleaner(source[key]);
    else result[key] = cleaner(fallback);
  });
  if (source) {
    Object.entries(source).forEach(([key, value]) => {
      if (validMonthKey(key) && !Object.hasOwn(result, key)) result[key] = cleaner(value);
    });
  }
  return result;
}

export function migrateMonthScopedSetup(saved, { currentKey = '', people = [], accounts = [] } = {}) {
  const keys = knownMonthKeys(saved, currentKey);
  const legacyHidden = cleanHidden(saved?.hiddenCats);
  return {
    peopleByMonth: migrateMap(saved?.peopleByMonth, keys, people, cleanPeople),
    accountsByMonth: migrateMap(saved?.accountsByMonth, keys, accounts, cleanAccounts),
    hiddenCatsByMonth: migrateMap(saved?.hiddenCatsByMonth, keys, legacyHidden, cleanHidden),
  };
}

export function cloneMonthSetup(state, sourceMonthKey, targetMonthKey, selection = {}) {
  if (!validMonthKey(sourceMonthKey) || !validMonthKey(targetMonthKey)) return {};
  const copyAccounts = Boolean(selection.copyAccounts);
  const copyPeople = Boolean(selection.copyPeople || copyAccounts);
  const result = {};
  if (copyPeople) result.people = getMonthPeople(state, sourceMonthKey);
  if (copyAccounts) result.accounts = getMonthAccounts(state, sourceMonthKey);
  if (selection.copyCategories) result.hiddenCats = getMonthHiddenCats(state, sourceMonthKey);
  if (selection.copyBankBalances) result.bankBalances = cloneList(state?.bankBalancesByMonth?.[sourceMonthKey]);
  if (selection.copySavings) result.savings = cloneList(state?.savingsByMonth?.[sourceMonthKey]);
  if (selection.copyBudget && state?.budgetsByMonth?.[sourceMonthKey]) result.budget = { ...state.budgetsByMonth[sourceMonthKey] };
  return result;
}

export function setMonthList(record, monthKey, value, cleaner = cloneList) {
  if (!validMonthKey(monthKey)) return record || {};
  return { ...(record || {}), [monthKey]: cleaner(value) };
}

export const cleanMonthPeople = cleanPeople;
export const cleanMonthAccounts = cleanAccounts;
export const cleanMonthHiddenCats = cleanHidden;
