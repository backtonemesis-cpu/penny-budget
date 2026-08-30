import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/apply-v40-savings-accounts.mjs';
const before = await readFile(path, 'utf8');
const after = before
  .replaceAll('\\\\${', '\\${')
  .replace(
    "  text = text.replace('export const CURRENT_STATE_VERSION = 11;', 'export const CURRENT_STATE_VERSION = 12;');\n",
    "  // v40 is additive: keep the existing state version so older v11 backups remain directly compatible.\n",
  )
  .replace(
    "    '    hiddenCatsByMonth,\\n    savingsByMonth,',\n    '    hiddenCatsByMonth,\\n    savingsAccounts,\\n    savingsByMonth,',",
    "    '    savingsByMonth,\\n    bankBalancesByMonth,',\n    '    savingsAccounts,\\n    savingsByMonth,\\n    bankBalancesByMonth,',",
  );
if (after !== before) await writeFile(path, after);
