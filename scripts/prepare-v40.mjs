import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/apply-v40-savings-accounts.mjs';
const before = await readFile(path, 'utf8');
const oldReturnPatch = `  text = once(\n    text,\n    '    hiddenCatsByMonth,\\n    savingsByMonth,',\n    '    hiddenCatsByMonth,\\n    savingsAccounts,\\n    savingsByMonth,',\n    'return savings master list',\n  );`;
const newReturnPatch = `  if (!text.includes('    savingsAccounts,\\n    savingsByMonth,')) {\n    const returnAnchor = '    savingsByMonth,\\n    bankBalancesByMonth,';\n    if (!text.includes(returnAnchor)) throw new Error('v40 missing finance return anchor');\n    text = text.replace(returnAnchor, '    savingsAccounts,\\n    savingsByMonth,\\n    bankBalancesByMonth,');\n  }`;
const after = before
  .replaceAll('\\\\${', '\\${')
  .replace(
    "  text = text.replace('export const CURRENT_STATE_VERSION = 11;', 'export const CURRENT_STATE_VERSION = 12;');\n",
    "  // v40 is additive: keep the existing state version so older v11 backups remain directly compatible.\n",
  )
  .replace(oldReturnPatch, newReturnPatch);
if (after !== before) await writeFile(path, after);
