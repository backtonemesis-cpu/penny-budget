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

// Legacy self-test expected month merges to mutate the old global reference lists.
// v28 deliberately keeps setup month-scoped, so assert the imported references on the imported month instead.
const selfTestPath = 'scripts/self-test.mjs';
let selfTest = await readFile(selfTestPath, 'utf8');
selfTest = selfTest.replace(
  "assert.equal(merged.people.some((person) => person.id === 'p3'), true);\nassert.equal(merged.accounts.some((account) => account.id === 'a3'), true);",
  "assert.equal(merged.peopleByMonth['2026-06'].some((person) => person.id === 'p3'), true);\nassert.equal(merged.accountsByMonth['2026-06'].some((account) => account.id === 'a3'), true);",
);
await writeFile(selfTestPath, selfTest);

console.log('PENNY_V28_MONTH_SCOPED driver completed');
