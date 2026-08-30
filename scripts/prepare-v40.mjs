import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/apply-v40-savings-accounts.mjs';
const before = await readFile(path, 'utf8');
const oldReturnPatch = `  text = once(\n    text,\n    '    hiddenCatsByMonth,\\n    savingsByMonth,',\n    '    hiddenCatsByMonth,\\n    savingsAccounts,\\n    savingsByMonth,',\n    'return savings master list',\n  );`;
const robustReturnPatch = `  if (!text.includes('savingsAccounts,')) {\n    const migrateStart = text.indexOf('export function migrateState(');\n    const returnStart = text.indexOf('  return {', migrateStart);\n    const savingsField = text.indexOf('savingsByMonth', returnStart);\n    if (migrateStart < 0 || returnStart < 0 || savingsField < 0) throw new Error('v40 could not locate migrateState return savings field');\n    text = text.slice(0, savingsField) + 'savingsAccounts,\\n    ' + text.slice(savingsField);\n  }`;
const oldStorageMergePatch = `  text = once(\n    text,\n    '    accounts: mergeAccountsById(current.accounts, incoming.accounts),\\n    auditLog:',\n    '    accounts: mergeAccountsById(current.accounts, incoming.accounts),\\n    savingsAccounts: mergeById(current.savingsAccounts, incoming.savingsAccounts),\\n    auditLog:',\n    'merge imported savings references',\n  );`;
const robustStorageMergePatch = `  if (!text.includes('savingsAccounts: mergeById(current.savingsAccounts, incoming.savingsAccounts)')) {\n    const mergeStart = text.indexOf('export function mergeImportedMonths(');\n    const returnStart = text.indexOf('  return migrateState({', mergeStart);\n    const auditField = text.indexOf('    auditLog:', returnStart);\n    if (mergeStart < 0 || returnStart < 0 || auditField < 0) throw new Error('v40 could not locate mergeImportedMonths audit field');\n    text = text.slice(0, auditField) + '    savingsAccounts: mergeById(current.savingsAccounts, incoming.savingsAccounts),\\n' + text.slice(auditField);\n  }`;
const after = before
  .replaceAll('\\\\${', '\\${')
  .replace(
    "  text = text.replace('export const CURRENT_STATE_VERSION = 11;', 'export const CURRENT_STATE_VERSION = 12;');\n",
    "  // v40 is additive: keep the existing state version so older v11 backups remain directly compatible.\n",
  )
  .replace(oldReturnPatch, robustReturnPatch)
  .replace(oldStorageMergePatch, robustStorageMergePatch);
if (after !== before) await writeFile(path, after);
