import { readFile, writeFile } from 'node:fs/promises';

const financePath = 'src/finance.js';
const financeMarker = 'PENNY_V76_MONTH_ACCOUNT_SUMMARY';
let finance = await readFile(financePath, 'utf8');
if (!finance.includes(financeMarker)) {
  const monthScopeImport = /import\s*\{([^}]*)\}\s*from '\.\/month-scope\.js';[^\n]*/;
  const match = finance.match(monthScopeImport);
  if (!match) throw new Error('v76 could not find the month-scope finance import.');
  const names = match[1].split(',').map((item) => item.trim()).filter(Boolean);
  if (!names.includes('getMonthAccounts')) names.unshift('getMonthAccounts');
  finance = finance.replace(monthScopeImport, `import { ${names.join(', ')} } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED`);

  const summaryTarget = "  const masterAccounts = Object.fromEntries((state?.accounts || []).map((account) => [account.id, account]));";
  const summaryReplacement = "  const masterAccounts = Object.fromEntries(getMonthAccounts(state, monthKey).map((account) => [account.id, account])); // PENNY_V76_MONTH_ACCOUNT_SUMMARY";
  if (!finance.includes(summaryTarget)) throw new Error('v76 could not find the Transfer Plan master-account source.');
  finance = finance.replace(summaryTarget, summaryReplacement);
  await writeFile(financePath, finance);
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
