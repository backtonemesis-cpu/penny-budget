import { CURRENT_STATE_VERSION, createBlankState, isValidMonthKey, migrateState } from './finance.js';

export const STORAGE_KEY = 'penny_state';
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const KNOWN_STATE_FIELDS = [
  'version',
  'txnsByMonth',
  'incomeByMonth',
  'customCats',
  'hiddenCats',
  'people',
  'accounts',
  'savingsByMonth',
  'monthStatusByMonth',
  'openingSavingsByMonth',
  'savingsAccounts',
  'savingsGoal',
  'savingsContrib',
  'savingsBal',
  'budgetsByMonth',
  'budgets',
  'sources',
  'dueDays',
];

function isStateCandidate(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && KNOWN_STATE_FIELDS.some((field) => Object.hasOwn(value, field)),
  );
}

function mergeById(existing = [], incoming = []) {
  const merged = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (item?.id && !merged.has(item.id)) merged.set(item.id, item);
  });
  return [...merged.values()];
}

export function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadState(storage, now = new Date()) {
  if (!storage) {
    return {
      state: createBlankState(),
      warning: 'Browser storage is unavailable. Penny can be used temporarily, but changes will not survive after the app closes.',
    };
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: createBlankState(), warning: '' };
    const parsed = JSON.parse(raw);
    if (!isStateCandidate(parsed)) throw new Error('Unknown state shape');
    return { state: migrateState(parsed, now), warning: '' };
  } catch {
    return {
      state: createBlankState(),
      warning: 'Saved Penny data could not be read. A blank in-memory session has been opened; your stored file was not overwritten.',
    };
  }
}

export function saveState(storage, state) {
  if (!storage) return { ok: false, error: 'Browser storage is unavailable. Export a backup before closing Penny.' };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true, error: '' };
  } catch {
    return { ok: false, error: 'Penny could not save to this browser. Export a backup before closing the app.' };
  }
}

export function createBackupText(state, now = new Date()) {
  return JSON.stringify({
    app: 'Penny',
    formatVersion: CURRENT_STATE_VERSION,
    exportedAt: now.toISOString(),
    state,
  }, null, 2);
}

function parseRawBackup(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The backup file is empty.');
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('The backup file is larger than 5 MB.');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The backup does not contain a valid Penny state.');
  if (parsed.app && parsed.app !== 'Penny') throw new Error('This backup belongs to a different app.');
  const candidate = parsed.state ?? parsed;
  if (!isStateCandidate(candidate)) throw new Error('The backup does not contain a recognised Penny state.');
  return { parsed, candidate };
}

export function parseBackupPackage(text, now = new Date()) {
  const { parsed, candidate } = parseRawBackup(text);
  const state = migrateState(candidate, now);
  const requestedMonths = Array.isArray(parsed.mergeMonths)
    ? [...new Set(parsed.mergeMonths.filter(isValidMonthKey))]
    : [];
  const importMode = parsed.importMode === 'merge_months' && requestedMonths.length ? 'merge_months' : 'replace';
  return { state, importMode, mergeMonths: importMode === 'merge_months' ? requestedMonths : [] };
}

export function parseBackupText(text, now = new Date()) {
  return parseBackupPackage(text, now).state;
}

export function mergeImportedMonths(currentState, incomingState, monthKeys, now = new Date()) {
  const current = migrateState(currentState, now);
  const incoming = migrateState(incomingState, now);
  const validMonths = [...new Set((monthKeys || []).filter(isValidMonthKey))];
  if (!validMonths.length) return current;

  const txnsByMonth = { ...current.txnsByMonth };
  const incomeByMonth = { ...current.incomeByMonth };
  const savingsByMonth = { ...current.savingsByMonth };
  const monthStatusByMonth = { ...current.monthStatusByMonth };
  const openingSavingsByMonth = { ...current.openingSavingsByMonth };
  const budgetsByMonth = { ...current.budgetsByMonth };

  validMonths.forEach((monthKey) => {
    if (incoming.txnsByMonth[monthKey]?.length) txnsByMonth[monthKey] = incoming.txnsByMonth[monthKey];
    else delete txnsByMonth[monthKey];

    if (incoming.incomeByMonth[monthKey]?.length) incomeByMonth[monthKey] = incoming.incomeByMonth[monthKey];
    else delete incomeByMonth[monthKey];

    if (incoming.savingsByMonth[monthKey]?.length) savingsByMonth[monthKey] = incoming.savingsByMonth[monthKey];
    else delete savingsByMonth[monthKey];

    if (incoming.monthStatusByMonth[monthKey] === 'closed') monthStatusByMonth[monthKey] = 'closed';
    else delete monthStatusByMonth[monthKey];

    if (Number(incoming.openingSavingsByMonth[monthKey]) > 0) openingSavingsByMonth[monthKey] = incoming.openingSavingsByMonth[monthKey];
    else delete openingSavingsByMonth[monthKey];

    if (incoming.budgetsByMonth[monthKey]) budgetsByMonth[monthKey] = incoming.budgetsByMonth[monthKey];
    else delete budgetsByMonth[monthKey];
  });

  return migrateState({
    ...current,
    version: CURRENT_STATE_VERSION,
    txnsByMonth,
    incomeByMonth,
    savingsByMonth,
    monthStatusByMonth,
    openingSavingsByMonth,
    budgetsByMonth,
    customCats: mergeById(current.customCats, incoming.customCats),
    people: mergeById(current.people, incoming.people),
    accounts: mergeById(current.accounts, incoming.accounts),
  }, now);
}

export function clearPennyState(storage) {
  if (!storage) return { ok: false, error: 'Browser storage is unavailable, so there is no saved Penny data to erase.' };
  try {
    storage.removeItem(STORAGE_KEY);
    return { ok: true, error: '' };
  } catch {
    return { ok: false, error: 'Penny could not erase its saved browser data.' };
  }
}
