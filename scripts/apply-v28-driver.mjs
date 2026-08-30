import { readFile, writeFile } from 'node:fs/promises';

const financePath = 'src/finance.js';
let finance = await readFile(financePath, 'utf8');
if (!finance.includes('peopleByMonth,')) {
  const anchor = "    people,\n    accounts,\n    savingsByMonth,";
  if (!finance.includes(anchor)) throw new Error('v28 driver could not prepare finance return anchor.');
  finance = finance.replace(anchor, "    people,\n    accounts,\n    savingsByMonth: savingsByMonth,");
  await writeFile(financePath, finance);
}

await import('./apply-v28-patches.mjs');

finance = await readFile(financePath, 'utf8');
finance = finance.replace(
  "import { migrateMonthScopedSetup } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED",
  "import { getMonthAccounts, migrateMonthScopedSetup } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED",
);
finance = finance.replace(
  "  const masterAccounts = Object.fromEntries((state?.accounts || []).map((account) => [account.id, account]));",
  "  const masterAccounts = Object.fromEntries(getMonthAccounts(state, monthKey).map((account) => [account.id, account]));",
);
await writeFile(financePath, finance);
console.log('PENNY_V28_MONTH_SCOPED driver completed');
