import { readFile, writeFile } from 'node:fs/promises';

// v28 already makes monthSummary use getMonthAccounts(state, monthKey).
// v76 only needs to make recurring bill copies prefer an explicitly prepared
// target-month account list when that month has its own owner-specific setup.
const finance = await readFile('src/finance.js', 'utf8');
if (!finance.includes('getMonthAccounts(state, monthKey)')) {
  throw new Error('v76 safety check failed: Transfer Plan is not using selected-month accounts.');
}

const monthSetupPath = 'src/month-setup.js';
const monthSetupMarker = 'PENNY_V76_TARGET_MONTH_ACCOUNTS';
let monthSetup = await readFile(monthSetupPath, 'utf8');
if (!monthSetup.includes(monthSetupMarker)) {
  const billStart = monthSetup.indexOf('export function buildRecurringBillCopies(');
  const incomeStart = monthSetup.indexOf('export function buildRecurringIncomeCopies(', billStart);
  if (!(billStart >= 0 && incomeStart > billStart)) throw new Error('v76 could not isolate recurring bill copy logic.');

  const billBlock = monthSetup.slice(billStart, incomeStart);
  const refsPattern = /  const people = Object\.fromEntries\(getMonthPeople\(state, setup\.sourceMonthKey\)\.map\(\(person\) => \[person\.id, person\]\)\);\n  const accounts = Object\.fromEntries\(getMonthAccounts\(state, setup\.sourceMonthKey\)\.map\(\(account\) => \[account\.id, account\]\)\);/;
  const targetRefs = "  const targetHasPeople = Boolean(state?.peopleByMonth && Object.hasOwn(state.peopleByMonth, targetMonthKey));\n  const targetHasAccounts = Boolean(state?.accountsByMonth && Object.hasOwn(state.accountsByMonth, targetMonthKey));\n  const people = Object.fromEntries(getMonthPeople(state, targetHasPeople ? targetMonthKey : setup.sourceMonthKey).map((person) => [person.id, person]));\n  const accounts = Object.fromEntries(getMonthAccounts(state, targetHasAccounts ? targetMonthKey : setup.sourceMonthKey).map((account) => [account.id, account])); // PENNY_V76_TARGET_MONTH_ACCOUNTS";
  if (!refsPattern.test(billBlock)) throw new Error('v76 could not find source-month recurring bill references.');
  const updatedBillBlock = billBlock.replace(refsPattern, targetRefs);
  monthSetup = monthSetup.slice(0, billStart) + updatedBillBlock + monthSetup.slice(incomeStart);
  await writeFile(monthSetupPath, monthSetup);
}
