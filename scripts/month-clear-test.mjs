import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/month-clear.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/overview-compact-v12.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

assert.match(main, /installMonthClearControl/, 'Month-clear control must be installed after Penny renders.');
assert.match(source, /globalThis\.confirm\(/, 'Clearing a month must require explicit confirmation.');
assert.match(source, /\.locked-banner/, 'Completed months must require the existing correction unlock before clearing.');
assert.match(source, /txnsByMonth: withoutKey/, 'Month transactions must be removed only for the selected month.');
assert.match(source, /incomeByMonth: withoutKey/, 'Month income must be removed only for the selected month.');
assert.match(source, /bankBalancesByMonth: withoutKey/, 'Month bank-balance evidence must be removed only for the selected month.');
assert.match(source, /budgetsByMonth: withoutKey/, 'Month-specific budget/setup data must be removed only for the selected month.');
assert.match(source, /monthMetaByMonth: withoutKey/, 'Cleared completed-month status must not remain attached to an empty month.');
assert.doesNotMatch(source, /savingsByMonth: withoutKey/, 'Savings history must never be cleared with month data.');
assert.match(source, /action: 'clear_month'/, 'Clear month must create one auditable Change History event.');
assert.match(source, /before,/, 'The audit event must retain the pre-clear month snapshot.');
assert.match(source, /Backup and Recovery/, 'Clear Month must be located in the Settings Backup and Recovery section.');
assert.match(source, /data-penny-clear-month-settings/, 'Settings must own the Clear Month control.');
assert.doesNotMatch(source, /month-setup-card.*appendChild/s, 'Clear Month must not be injected into Overview month setup.');
assert.doesNotMatch(source, /metric-grid.*insertAdjacentElement/s, 'Clear Month must not be injected beside Overview metrics.');
assert.match(source, /button\.textContent !== buttonLabel/, 'Settings Clear Month must not rewrite identical text on every MutationObserver callback.');
assert.match(source, /requestAnimationFrame/, 'Settings Clear Month observer updates must be coalesced so UI input cannot be starved.');
assert.doesNotMatch(source, /settings-month-data-copy/, 'Redundant explanatory copy must not appear above the Clear Month button.');
assert.match(source, /className = 'danger-button settings-clear-month-button'/, 'Clear Month must share the same destructive-action theme as Erase Penny data.');
assert.match(source, /Clear \$\{label\} data only\?/, 'Confirmation must explicitly state the selected-month-only scope.');
assert.match(css, /\.attention-card > \.section-heading \.section-note \{\s*display: none;/s, 'The long transfer-plan explanation must remain hidden on mobile.');
assert.match(css, /\.settings-month-data-row \{[\s\S]*margin: 14px 0 12px;/, 'Clear Month must have deliberate spacing from the Erase Penny action.');
assert.match(css, /\.settings-clear-month-button \{[\s\S]*width: 100%;[\s\S]*min-height: 52px;[\s\S]*background: rgba\(240, 107, 107, 0\.1\);/, 'Clear Month must be a full-width action using the same destructive background as Penny danger buttons.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.settings-clear-month-button \{[\s\S]*min-height: 50px;/, 'Clear Month must retain a substantial mobile touch target.');

console.log('Penny clear-month regression passed: Settings-only, confirmed, scoped, auditable, uniform and uncluttered.');
