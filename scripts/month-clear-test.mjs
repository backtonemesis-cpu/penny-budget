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
assert.match(css, /\.attention-card > \.section-heading \.section-note \{\s*display: none;/s, 'The long transfer-plan explanation must remain hidden on mobile.');
assert.match(css, /\.settings-clear-month-button \{[\s\S]*min-height: 40px;/, 'Settings Clear Month action must retain a discreet but usable touch target.');

console.log('Penny clear-month regression passed: Settings-only, confirmed, scoped, auditable and interaction-safe.');
