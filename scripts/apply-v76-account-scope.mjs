import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/finance.js';
const marker = 'PENNY_V76_MONTH_ACCOUNT_SUMMARY';
const before = await readFile(path, 'utf8');
if (before.includes(marker)) process.exit(0);

let after = before;
const importTarget = "import { migrateMonthScopedSetup } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED";
const importReplacement = "import { getMonthAccounts, migrateMonthScopedSetup } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED";
if (!after.includes(importTarget)) throw new Error('v76 could not find the v28 month-scope finance import.');
after = after.replace(importTarget, importReplacement);

const summaryTarget = "  const masterAccounts = Object.fromEntries((state?.accounts || []).map((account) => [account.id, account]));";
const summaryReplacement = "  const masterAccounts = Object.fromEntries(getMonthAccounts(state, monthKey).map((account) => [account.id, account])); // PENNY_V76_MONTH_ACCOUNT_SUMMARY";
if (!after.includes(summaryTarget)) throw new Error('v76 could not find the Transfer Plan master-account source.');
after = after.replace(summaryTarget, summaryReplacement);

await writeFile(path, after);
