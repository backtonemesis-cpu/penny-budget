import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/finance.js';
let text = await readFile(path, 'utf8');

const before = `  let savingsByMonth = normaliseSavingsByMonth(saved.savingsByMonth);\n  if (!Object.keys(savingsByMonth).length) {`;
const after = `  let savingsByMonth = normaliseSavingsByMonth(saved.savingsByMonth);\n  // PENNY_V87_BLANK_MONTH_SAVINGS: savingsAccounts is a current master list from state v12 onward.\n  // It must never recreate a monthly savings snapshot after Reset Month has deliberately cleared the last snapshot.\n  const savedVersion = Number(saved.version);\n  const canHydrateLegacySavingsSnapshot = !Number.isFinite(savedVersion) || savedVersion < 12;\n  if (!Object.keys(savingsByMonth).length && canHydrateLegacySavingsSnapshot) {`;

if (!text.includes('PENNY_V87_BLANK_MONTH_SAVINGS')) {
  if (!text.includes(before)) throw new Error('v87 missing anchor: legacy savings snapshot migration');
  text = text.replace(before, after);
}

if (!text.includes('const canHydrateLegacySavingsSnapshot = !Number.isFinite(savedVersion) || savedVersion < 12;')) {
  throw new Error('v87 failed to protect blank current-version months from savings rehydration.');
}

await writeFile(path, text);
console.log('PENNY_V87 blank-month savings migration guard applied');
