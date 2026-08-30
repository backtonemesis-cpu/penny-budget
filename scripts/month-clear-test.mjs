import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/month-clear.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/overview-compact-v12.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

assert.match(main, /installMonthClearControl/, 'Month-reset control must be installed after Penny renders.');
assert.match(source, /globalThis\.confirm\(/, 'Resetting a month must require explicit confirmation.');
assert.match(source, /\.locked-banner/, 'Completed months must require the existing correction unlock before resetting.');
assert.match(source, /txnsByMonth: withoutKey/, 'Month transactions must be removed only for the selected month.');
assert.match(source, /incomeByMonth: withoutKey/, 'Month income must be removed only for the selected month.');
assert.match(source, /peopleByMonth: emptyMonthList/, 'Selected-month household people must be explicitly reset to an empty list.');
assert.match(source, /accountsByMonth: emptyMonthList/, 'Selected-month accounts and ownership must be explicitly reset to an empty list.');
assert.match(source, /hiddenCatsByMonth: emptyMonthList/, 'Selected-month category visibility/setup must be reset.');
assert.match(source, /bankBalancesByMonth: withoutKey/, 'Selected-month bank-balance evidence must be removed.');
assert.match(source, /savingsByMonth: withoutKey/, 'Selected-month savings snapshot must be removed so a full month reset is genuinely blank.');
assert.match(source, /budgetsByMonth: withoutKey/, 'Month-specific budget/setup data must be removed only for the selected month.');
assert.match(source, /monthMetaByMonth: withoutKey/, 'Reset completed-month status must not remain attached to an empty month.');
assert.match(source, /action: 'clear_month'/, 'Reset month must create one auditable Change History event.');
assert.match(source, /before,/, 'The audit event must retain the pre-reset month snapshot.');
assert.match(source, /No other month is changed/, 'Confirmation must explicitly promise that every other month is preserved.');
assert.match(source, /Reset \$\{label\} to a completely blank month\?/, 'Confirmation must clearly describe a full standalone-month reset.');
assert.match(source, /Backup and Recovery/, 'Reset Month must be located in the Settings Backup and Recovery section.');
assert.match(source, /data-penny-clear-month-settings/, 'Settings must own the Reset Month control.');
assert.doesNotMatch(source, /month-setup-card.*appendChild/s, 'Reset Month must not be injected into Overview month setup.');
assert.doesNotMatch(source, /metric-grid.*insertAdjacentElement/s, 'Reset Month must not be injected beside Overview metrics.');
assert.match(source, /button\.textContent !== buttonLabel/, 'Settings Reset Month must not rewrite identical text on every MutationObserver callback.');
assert.match(source, /requestAnimationFrame/, 'Settings Reset Month observer updates must be coalesced so UI input cannot be starved.');
assert.doesNotMatch(source, /settings-month-data-copy/, 'Redundant explanatory copy must not appear above the Reset Month button.');
assert.match(source, /className = 'danger-button settings-clear-month-button'/, 'Reset Month must share the same destructive-action theme as Erase Penny data.');
assert.match(css, /\.attention-card > \.section-heading \.section-note \{\s*display: none;/s, 'The long transfer-plan explanation must remain hidden on mobile.');
assert.match(css, /\.settings-month-data-row \{[\s\S]*margin: 14px 0 12px;/, 'Reset Month must have deliberate spacing from the Erase Penny action.');
assert.match(css, /\.settings-clear-month-button \{[\s\S]*width: 100%;[\s\S]*min-height: 52px;[\s\S]*background: rgba\(240, 107, 107, 0\.1\);/, 'Reset Month must be a full-width action using the same destructive background as Penny danger buttons.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.settings-clear-month-button \{[\s\S]*min-height: 50px;/, 'Reset Month must retain a substantial mobile touch target.');

console.log('Penny standalone month reset regression passed: Settings-only, fully blank, other months preserved, confirmed and auditable.');
