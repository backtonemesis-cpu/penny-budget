import {
  CURRENT_STATE_VERSION,
  MAX_AUDIT_ENTRIES,
  createBlankState,
  isValidMonthKey,
  migrateState,
} from './finance.js';

export const STORAGE_KEY = 'penny_state';
export const ROLLBACK_STORAGE_KEY = 'penny_state_before_last_import';
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
  'bankBalancesByMonth',
  'monthMetaByMonth',
  'savingsAccounts',
  'savingsGoal',
  'savingsContrib',
  'savingsBal',
  'budgetsByMonth',
  'budgets',
  'sources',
  'dueDays',
  'auditLog',
];

function isStateCandidate(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && KNOWN_STATE_FIELDS.some((field) => Object.hasOwn(value, field)),
  );
}

function hasFutureStateVersion(value) {
  const version = Number(value?.version);
  return Number.isFinite(version) && version > CURRENT_STATE_VERSION;
}

function mergeById(existing = [], incoming = []) {
  const merged = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (item?.id && !merged.has(item.id)) merged.set(item.id, item);
  });
  return [...merged.values()];
}

function mergeAccountsById(existing = [], incoming = []) {
  const merged = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (!item?.id) return;
    const current = merged.get(item.id);
    if (!current) {
      merged.set(item.id, item);
      return;
    }
    const currentOwner = current.ownerId || 'unassigned';
    const incomingOwner = item.ownerId || 'unassigned';
    if (currentOwner === 'unassigned' && incomingOwner !== 'unassigned') {
      merged.set(item.id, { ...current, ownerId: incomingOwner });
    }
  });
  return [...merged.values()];
}

function mergeAuditLogs(existing = [], incoming = []) {
  const merged = new Map();
  [...existing, ...incoming].forEach((entry) => {
    if (entry?.id && !merged.has(entry.id)) merged.set(entry.id, entry);
  });
  return [...merged.values()]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, MAX_AUDIT_ENTRIES);
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
      recoveryRequired: false,
    };
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: createBlankState(), warning: '', recoveryRequired: false };
    const parsed = JSON.parse(raw);
    if (!isStateCandidate(parsed)) throw new Error('Unknown state shape');
    if (hasFutureStateVersion(parsed)) {
      return {
        state: createBlankState(),
        warning: 'Saved Penny data was created by a newer Penny data format. Editing is locked so the newer saved data is not overwritten. Update Penny or import a compatible backup.',
        recoveryRequired: true,
      };
    }
    return { state: migrateState(parsed, now), warning: '', recoveryRequired: false };
  } catch {
    return {
      state: createBlankState(),
      warning: 'Saved Penny data could not be read. Editing is locked so the unreadable stored data is not overwritten. Import a valid backup or erase the damaged local copy in Settings.',
      recoveryRequired: true,
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

export function saveRollbackState(storage, state) {
  if (!storage) return { ok: false, error: 'Browser storage is unavailable.' };
  try {
    storage.setItem(ROLLBACK_STORAGE_KEY, JSON.stringify(state));
    return { ok: true, error: '' };
  } catch {
    return { ok: false, error: 'Penny could not create the automatic pre-import recovery copy.' };
  }
}

export function hasRollbackState(storage) {
  if (!storage) return false;
  try {
    return Boolean(storage.getItem(ROLLBACK_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function loadRollbackState(storage, now = new Date()) {
  if (!storage) throw new Error('Browser storage is unavailable.');
  const raw = storage.getItem(ROLLBACK_STORAGE_KEY);
  if (!raw) throw new Error('There is no automatic pre-import recovery copy.');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The automatic recovery copy could not be read.');
  }
  if (!isStateCandidate(parsed)) throw new Error('The automatic recovery copy is not a recognised Penny state.');
  if (hasFutureStateVersion(parsed)) throw new Error('The automatic recovery copy was created by a newer Penny data format. Update Penny before restoring it.');
  return migrateState(parsed, now);
}

export function clearRollbackState(storage) {
  if (!storage) return;
  try {
    storage.removeItem(ROLLBACK_STORAGE_KEY);
  } catch {
    // The main Penny state remains untouched if cleanup fails.
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
  if (Number.isFinite(Number(parsed.formatVersion)) && Number(parsed.formatVersion) > CURRENT_STATE_VERSION) {
    throw new Error('This backup was created by a newer Penny data format. Update Penny before importing it.');
  }
  const candidate = parsed.state ?? parsed;
  if (!isStateCandidate(candidate)) throw new Error('The backup does not contain a recognised Penny state.');
  if (hasFutureStateVersion(candidate)) throw new Error('This backup contains a newer Penny state format. Update Penny before importing it.');
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

function tagImportedRows(rows = []) {
  return rows.map((row) => ({ ...row, source: row.source === 'manual' ? 'manual' : 'import' }));
}

export function mergeImportedMonths(currentState, incomingState, monthKeys, now = new Date()) {
  const current = migrateState(currentState, now);
  const incoming = migrateState(incomingState, now);
  const validMonths = [...new Set((monthKeys || []).filter(isValidMonthKey))];
  if (!validMonths.length) return current;

  const txnsByMonth = { ...current.txnsByMonth };
  const incomeByMonth = { ...current.incomeByMonth };
  const savingsByMonth = { ...current.savingsByMonth };
  const bankBalancesByMonth = { ...(current.bankBalancesByMonth || {}) };
  const monthMetaByMonth = { ...current.monthMetaByMonth };
  const budgetsByMonth = { ...current.budgetsByMonth };

  validMonths.forEach((monthKey) => {
    if (incoming.txnsByMonth[monthKey]?.length) txnsByMonth[monthKey] = tagImportedRows(incoming.txnsByMonth[monthKey]);
    else delete txnsByMonth[monthKey];
    if (incoming.incomeByMonth[monthKey]?.length) incomeByMonth[monthKey] = tagImportedRows(incoming.incomeByMonth[monthKey]);
    else delete incomeByMonth[monthKey];
    if (incoming.savingsByMonth[monthKey]?.length) savingsByMonth[monthKey] = incoming.savingsByMonth[monthKey];
    else delete savingsByMonth[monthKey];
    if (incoming.bankBalancesByMonth?.[monthKey]?.length) bankBalancesByMonth[monthKey] = incoming.bankBalancesByMonth[monthKey];
    else delete bankBalancesByMonth[monthKey];
    if (incoming.monthMetaByMonth[monthKey]) monthMetaByMonth[monthKey] = incoming.monthMetaByMonth[monthKey];
    else delete monthMetaByMonth[monthKey];
    if (incoming.budgetsByMonth[monthKey]) budgetsByMonth[monthKey] = incoming.budgetsByMonth[monthKey];
    else delete budgetsByMonth[monthKey];
  });

  return migrateState({
    ...current,
    version: CURRENT_STATE_VERSION,
    txnsByMonth,
    incomeByMonth,
    savingsByMonth,
    bankBalancesByMonth,
    monthMetaByMonth,
    budgetsByMonth,
    customCats: mergeById(current.customCats, incoming.customCats),
    people: mergeById(current.people, incoming.people),
    accounts: mergeAccountsById(current.accounts, incoming.accounts),
    auditLog: mergeAuditLogs(current.auditLog, incoming.auditLog),
  }, now);
}

export function clearPennyState(storage) {
  if (!storage) return { ok: false, error: 'Browser storage is unavailable, so there is no saved Penny data to erase.' };
  try {
    storage.removeItem(STORAGE_KEY);
    clearRollbackState(storage);
    return { ok: true, error: '' };
  } catch {
    return { ok: false, error: 'Penny could not erase its saved browser data.' };
  }
}
