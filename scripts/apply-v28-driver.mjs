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
finance = finance.replace("import { migrateMonthScopedSetup } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED", "import { getMonthAccounts, migrateMonthScopedSetup } from './month-scope.js'; // PENNY_V28_MONTH_SCOPED");
finance = finance.replace("  const masterAccounts = Object.fromEntries((state?.accounts || []).map((account) => [account.id, account]));", "  const masterAccounts = Object.fromEntries(getMonthAccounts(state, monthKey).map((account) => [account.id, account]));");
finance = finance.replace("      hasCurrentBalance: Boolean(bankBalance),", "      hasCurrentBalance: true, // PENNY_V29_DEFAULT_ZERO");
await writeFile(financePath, finance);

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');
app = app.replace("      auditLabel: balance == null ? `Clear ${account.label} bank balance to TBC` : `Update ${account.label} bank balance`,", "      auditLabel: balance == null ? `Reset ${account.label} bank balance to £0.00` : `Update ${account.label} bank balance`, // PENNY_V29_DEFAULT_ZERO");
app = app.replace("The old combined current bank balance will be cleared back to TBC.", "The old combined current bank balance will reset to £0.00.");
app = app.replace('        placeholder="TBC"', '        placeholder="0.00"');
app = app.replace("      <small>{editable ? 'Clear the field to return this balance to TBC.' : 'Assign a bill-paying account before entering a balance.'}</small>", "      <small>{editable ? 'If left blank, Penny treats the balance as £0.00.' : 'Assign a bill-paying account before entering a balance.'}</small>");
await writeFile(appPath, app);

const selfTestPath = 'scripts/self-test.mjs';
let selfTest = await readFile(selfTestPath, 'utf8');
selfTest = selfTest.replace("assert.equal(merged.people.some((person) => person.id === 'p3'), true);\nassert.equal(merged.accounts.some((account) => account.id === 'a3'), true);", "assert.equal(merged.peopleByMonth['2026-06'].some((person) => person.id === 'p3'), true);\nassert.equal(merged.accountsByMonth['2026-06'].some((account) => account.id === 'a3'), true);");
selfTest = selfTest.replace("assert.equal(july.accountFundingPlan[0].hasCurrentBalance, false, 'Missing bank balances must not be treated as confirmed zero evidence.');", "assert.equal(july.accountFundingPlan[0].hasCurrentBalance, true, 'Missing bank balances must default to zero for transfer planning.');");
selfTest = selfTest.replace("assert.equal(july.hasUnconfirmedBankBalances, true);", "assert.equal(july.hasUnconfirmedBankBalances, false);");
await writeFile(selfTestPath, selfTest);

const settingsAuditPath = 'scripts/settings-menu-audit.mjs';
let settingsAudit = await readFile(settingsAuditPath, 'utf8');
settingsAudit = settingsAudit.replace("assert.match(appSource, /disabled=\\{recoveryRequired\\}[^>]*onClick=\\{onExport\\}/s, 'Normal backup export must remain disabled during protected recovery.');", "assert.match(appSource, /disabled=\\{recoveryRequired \\|\\| \\(exportScope === 'choose'/, 'Scoped backup export must remain disabled during protected recovery.');");
await writeFile(settingsAuditPath, settingsAudit);

const viewportTestPath = 'scripts/settings-viewport-test.mjs';
let viewportTest = await readFile(viewportTestPath, 'utf8');
viewportTest = viewportTest.replace("assert.match(categoryJs, /Global setup — kept when you clear a month/, 'Settings must explicitly distinguish global setup from month-specific data.');\nassert.match(categoryJs, /A person can be removed once they no longer own an active account/, 'Household People must explain that historical rows do not permanently lock the current master list.');", "assert.match(categoryJs, /Month setup — applies to the selected month only/, 'Settings must explicitly identify month-specific setup.');\nassert.match(categoryJs, /Other months keep their own household people/, 'Household People must explain that each month keeps an independent list.');");
await writeFile(viewportTestPath, viewportTest);

const clearTestPath = 'scripts/month-clear-test.mjs';
let clearTest = await readFile(clearTestPath, 'utf8');
clearTest = clearTest.replace("assert.doesNotMatch(source, /savingsByMonth: withoutKey/, 'Savings history must never be cleared with month data.');", "assert.match(source, /savingsByMonth: withoutKey/, 'Reset Month must clear only the selected month savings snapshot so the month is genuinely blank.');");
clearTest = clearTest.replace("assert.match(source, /Clear \\$\\{label\\} data only\\?/, 'Confirmation must explicitly state the selected-month-only scope.');", "assert.match(source, /Reset \\$\\{label\\} to a completely blank month\\?/, 'Confirmation must explicitly state the selected-month blank reset scope.');");
await writeFile(clearTestPath, clearTest);

const sourceAuditPath = 'scripts/source-audit.mjs';
let sourceAudit = await readFile(sourceAuditPath, 'utf8');
sourceAudit = sourceAudit.replace("assert.match(files.finance, /CURRENT_STATE_VERSION = 10/);", "assert.match(files.finance, /CURRENT_STATE_VERSION = 11/);\n  assert.match(files.finance, /hasCurrentBalance: true, \/\/ PENNY_V29_DEFAULT_ZERO/, 'Missing bank-balance rows must default to confirmed zero for transfer planning.');\n  assert.match(files.app, /placeholder=\"0\\.00\"/, 'Current bank balance editor must display a zero default instead of TBC.');\n  assert.match(files.app, /If left blank, Penny treats the balance as £0\\.00\\./, 'Current bank balance helper must explain the zero default.');");
await writeFile(sourceAuditPath, sourceAudit);

console.log('PENNY_V28_MONTH_SCOPED driver completed');
