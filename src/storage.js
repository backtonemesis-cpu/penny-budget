import { CURRENT_STATE_VERSION, createBlankState, migrateState } from './finance.js';

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

export function parseBackupText(text, now = new Date()) {
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
  return migrateState(candidate, now);
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
