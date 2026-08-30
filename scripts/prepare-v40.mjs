import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/apply-v40-savings-accounts.mjs';
const before = await readFile(path, 'utf8');
const oldReturnPatch = `  text = once(\n    text,\n    '    hiddenCatsByMonth,\\n    savingsByMonth,',\n    '    hiddenCatsByMonth,\\n    savingsAccounts,\\n    savingsByMonth,',\n    'return savings master list',\n  );`;
const robustReturnPatch = `  if (!text.includes('savingsAccounts,')) {\n    const migrateStart = text.indexOf('export function migrateState(');\n    const returnStart = text.indexOf('  return {', migrateStart);\n    const savingsField = text.indexOf('savingsByMonth', returnStart);\n    if (migrateStart < 0 || returnStart < 0 || savingsField < 0) throw new Error('v40 could not locate migrateState return savings field');\n    text = text.slice(0, savingsField) + 'savingsAccounts,\\n    ' + text.slice(savingsField);\n  }`;
const oldStorageMergePatch = `  text = once(\n    text,\n    '    accounts: mergeAccountsById(current.accounts, incoming.accounts),\\n    auditLog:',\n    '    accounts: mergeAccountsById(current.accounts, incoming.accounts),\\n    savingsAccounts: mergeById(current.savingsAccounts, incoming.savingsAccounts),\\n    auditLog:',\n    'merge imported savings references',\n  );`;
const robustStorageMergePatch = `  if (!text.includes('savingsAccounts: mergeById(current.savingsAccounts, incoming.savingsAccounts)')) {\n    const mergeStart = text.indexOf('export function mergeImportedMonths(');\n    const returnStart = text.indexOf('  return migrateState({', mergeStart);\n    const auditField = text.indexOf('    auditLog:', returnStart);\n    if (mergeStart < 0 || returnStart < 0 || auditField < 0) throw new Error('v40 could not locate mergeImportedMonths audit field');\n    text = text.slice(0, auditField) + '    savingsAccounts: mergeById(current.savingsAccounts, incoming.savingsAccounts),\\n' + text.slice(auditField);\n  }`;
const updateAccountAnchor = "  const updateAccount = (id, patch) => setAccounts(savingsAccounts.map((item) => item.id === id ? { ...item, ...patch } : item), 'Update savings account balance');\\n\\n  return (";
const updateAccountReplacement = "  const updateAccount = (id, patch) => setAccounts(savingsAccounts.map((item) => item.id === id ? { ...item, ...patch } : item), 'Update savings account balance');\\n  const goalRemaining = state.savingsGoal > 0 ? Math.max(state.savingsGoal - summary.currentSavings, 0) : null;\\n  const months = goalRemaining && state.savingsContrib > 0 ? Math.ceil(goalRemaining / state.savingsContrib) : null;\\n\\n  return (";
const savingsCloseAnchor = "        <div className=\"total-line\"><span>{summary.isComplete ? 'Closing Savings' : 'Savings Snapshot'}</span><span className=\"money green\">{formatMoney(summary.currentSavings)}</span></div>\\n      </section>\\n    </>";
const savingsCloseReplacement = "        <div className=\"total-line\"><span>{summary.isComplete ? 'Closing Savings' : 'Savings Snapshot'}</span><span className=\"money green\">{formatMoney(summary.currentSavings)}</span></div>\\n      </section>\\n      {!summary.isComplete && (\\n        <section className=\"card\" aria-labelledby=\"savings-goal-title\">\\n          <h2 className=\"section-title\" id=\"savings-goal-title\">Savings Goal</h2>\\n          <div className=\"form-grid\">\\n            <NumberField label=\"Goal\" value={state.savingsGoal} onCommit={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsGoal', value })} />\\n            <NumberField label=\"Monthly Contribution\" value={state.savingsContrib} onCommit={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsContrib', value })} />\\n          </div>\\n          <SummaryRow label=\"Remaining\" value={goalRemaining ?? 0} />\\n          <div className=\"row\"><div className=\"grow\">Forecast</div><div>{state.savingsGoal ? (goalRemaining === 0 ? 'Goal reached' : months ? String(months) + ' months' : 'Set monthly contribution') : 'Set a goal'}</div></div>\\n        </section>\\n      )}\\n    </>";

// The v28 Settings wrapper scopes people/accounts to a month. Savings-account identities are deliberately global.
const appSettingsAnchor = "    if (action.type === 'SET_REFERENCE_LIST') return mutate({ ...action, type: 'SET_MONTH_REFERENCE_LIST', monthKey });";
const appSettingsReplacement = "    if (action.type === 'SET_REFERENCE_LIST' && ['people', 'accounts'].includes(action.field)) return mutate({ ...action, type: 'SET_MONTH_REFERENCE_LIST', monthKey });";
const globalSavingsPatch = `\n  // Ensure Savings Accounts bypass the month-scoped people/account wrapper.\n  text = text.replace(${JSON.stringify(appSettingsAnchor)}, ${JSON.stringify(appSettingsReplacement)});\n`;

let after = before
  .replaceAll('\\\\${', '\\${')
  .replace(
    "  text = text.replace('export const CURRENT_STATE_VERSION = 11;', 'export const CURRENT_STATE_VERSION = 12;');\n",
    "  // v40 is additive: keep the existing state version so older v11 backups remain directly compatible.\n",
  )
  .replace(oldReturnPatch, robustReturnPatch)
  .replace(oldStorageMergePatch, robustStorageMergePatch)
  .replace(updateAccountAnchor, updateAccountReplacement)
  .replace(savingsCloseAnchor, savingsCloseReplacement);

const appBlockMarker = "  // Settings master list.\n";
if (!after.includes(globalSavingsPatch.trim()) && after.includes(appBlockMarker)) {
  after = after.replace(appBlockMarker, globalSavingsPatch + appBlockMarker);
}
if (after !== before) await writeFile(path, after);
