import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformRecordDateLayout } from '../build/record-date-layout.js';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const mobileCss = await readFile(new URL('../src/mobile-navigation.css', import.meta.url), 'utf8');
const transferPlanCss = await readFile(new URL('../src/transfer-plan-compact.css', import.meta.url), 'utf8');
const settingsCss = await readFile(new URL('../src/settings-fix.css', import.meta.url), 'utf8');
const recordEditorCss = await readFile(new URL('../src/record-editor-v62.css', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const transformedApp = transformRecordDateLayout(appSource);

assert.match(css, /\.modal \{[^}]*overflow: hidden;[^}]*overscroll-behavior: contain;/s, 'Modal backdrop must not become a second scroll container.');
assert.match(css, /\.modal-inner \{[^}]*max-height: calc\(100dvh - max\(14px, env\(safe-area-inset-top\)\) - max\(14px, env\(safe-area-inset-bottom\)\)\);[^}]*overflow-y: auto;[^}]*-webkit-overflow-scrolling: touch;/s, 'Modal content must use one safe-area-aware iOS vertical scroll container.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.modal-inner > \.actions \{[^}]*position: sticky;[^}]*bottom: -16px;/, 'Mobile editor actions must remain reachable while the form scrolls.');
assert.doesNotMatch(css, /\.modal \{[^}]*overflow-y: auto;/s, 'Modal backdrop must never regain independent vertical scrolling.');
assert.match(mobileCss, /html,\s*body,\s*#root \{[^}]*height: 100%;[^}]*overflow: hidden;[^}]*overscroll-behavior: none;/s, 'The browser document must be viewport-locked so iPhone root rubber-band scrolling cannot occur.');
assert.match(mobileCss, /\.app \{[^}]*height: 100dvh;[^}]*overflow-y: auto;[^}]*overscroll-behavior: none;[^}]*-webkit-overflow-scrolling: touch;/s, 'Penny itself must be the single page-level vertical scroll container.');
assert.match(mobileCss, /\.modal \{[^}]*overflow-x: clip;[^}]*overscroll-behavior-x: none;[^}]*touch-action: pan-y pinch-zoom;/s, 'Modal backdrop must reject horizontal panning on mobile.');
assert.match(mobileCss, /\.modal-inner \{[^}]*max-width: 100%;[^}]*overflow-x: hidden;[^}]*overscroll-behavior-x: none;[^}]*touch-action: pan-y pinch-zoom;/s, 'The iPhone editor scroll container must be locked to vertical scrolling only.');
assert.match(mobileCss, /@media \(max-width: 760px\)[\s\S]*?\.header-row \{[^}]*display: grid;[^}]*grid-template-columns: max-content minmax\(0, 1fr\) 40px 54px;[^}]*column-gap: 6px;/, 'Mobile header must prioritise the month with compact Settings/Add tracks and tighter gaps.');
assert.match(mobileCss, /@media \(max-width: 760px\)[\s\S]*?\.brand \{[^}]*font-size: 26px;[^}]*letter-spacing: -0\.055em;/, 'Mobile Penny branding must remain compact enough to give the month selector priority.');
assert.match(mobileCss, /\.month-control \{[^}]*max-width: 100%;[^}]*overflow: hidden;/s, 'The native month control must be clipped to its own header track instead of overlapping Settings.');
assert.match(mobileCss, /\.month-input \{[^}]*display: block;[^}]*max-width: 100%;[^}]*-webkit-appearance: none;[^}]*appearance: none;/s, 'The iPhone month input must shed native intrinsic chrome that clips the year.');
assert.match(mobileCss, /\.month-input::-webkit-datetime-edit \{[^}]*width: 100%;[^}]*justify-content: center;/s, 'The full month and year text must use the available header width.');
assert.match(mobileCss, /\.month-input::-webkit-calendar-picker-indicator \{[^}]*width: 0;[^}]*height: 0;[^}]*opacity: 0;/s, 'The invisible native picker indicator must not reserve horizontal space beside the month label.');
assert.match(mobileCss, /@media \(max-width: 760px\)[\s\S]*?\.icon-button \{[^}]*width: 40px;[^}]*font-size: 16px;[^}]*font-variant-emoji: text;/, 'Settings must use a compact text-style gear rather than an oversized emoji glyph.');
assert.match(mobileCss, /@media \(max-width: 760px\)[\s\S]*?\.add-button \{[^}]*width: 54px;[^}]*font-size: 14px;/, 'Add must stay compact while retaining its label.');
assert.match(mobileCss, /@media \(max-width: 390px\)[\s\S]*?\.header-row \{[^}]*grid-template-columns: max-content minmax\(0, 1fr\) 38px 52px;[^}]*column-gap: 5px;/, 'Narrow iPhones must reclaim additional width for the month selector.');
assert.match(mobileCss, /@media \(max-width: 390px\)[\s\S]*?\.brand \{[^}]*font-size: 24px;/, 'Narrow-iPhone branding must remain compact.');
assert.match(mobileCss, /@media \(max-width: 390px\)[\s\S]*?\.month-input \{[^}]*font-size: 15px;/, 'Narrow iPhones must use a compact month-label size rather than clipping the year.');
assert.match(transferPlanCss, /\.attention-card \.section-heading \.section-note \{\s*display: none;/s, 'Transfer-plan instructional copy must not consume mobile overview space.');
assert.match(transferPlanCss, /\.attention-card \.transfer-account-row > \.money,[\s\S]*\.attention-card \.transfer-breakdown,[\s\S]*\.attention-card \.funding-balance-editor small \{\s*display: none !important;/s, 'Duplicate information below each transfer-plan balance input must stay hidden on mobile.');
assert.match(transferPlanCss, /\.attention-card \.funding-balance-editor input \{\s*margin-bottom: 0;/s, 'The current-bank-balance input must visually end each mobile transfer account block.');

assert.doesNotMatch(settingsCss, /Record date visibility repair \(v59\)/, 'The obsolete v59 sticky Exact date workaround must stay removed.');
assert.doesNotMatch(settingsCss, /\.modal-inner:has\(> \.field > #record-date\).*position: sticky/s, 'Record date controls must not be pinned with a CSS scroll workaround.');
assert.match(recordEditorCss, /\.modal-inner #record-date \{[^}]*align-self: stretch;[^}]*width: auto !important;[^}]*inline-size: auto !important;[^}]*min-width: 0 !important;[^}]*-webkit-appearance: none;[^}]*appearance: none;/s, 'The iPhone date input must use the same available-width stretch behavior as other Income and Expense controls.');
assert.doesNotMatch(recordEditorCss, /\.modal-inner #record-date \{[^}]*width: 100% !important;/s, 'The iPhone date input must not use percentage sizing that can overflow its editor field.');
assert.match(recordEditorCss, /#record-date::-webkit-date-and-time-value,[\s\S]*#record-date::-webkit-datetime-edit \{[^}]*width: 100%;[^}]*text-align: center;/s, 'The iOS date text must remain centered inside the constrained control.');
assert.match(recordEditorCss, /\.modal-head-copy \{[^}]*flex: 1 1 auto;[^}]*min-width: 0;/s, 'The sticky editor header must reserve a safe flexible track for record identity.');
assert.match(recordEditorCss, /\.modal-context \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/s, 'Long Income or Expense identities must remain readable without colliding with Done.');
assert.match(transformedApp, /const recordContext = existing[\s\S]*?Income[\s\S]*?Expense[\s\S]*?Transfer[\s\S]*?formatMoney/s, 'The shared record editor must build a persistent identity from record type, description and amount.');
assert.match(transformedApp, /<SimpleModal title=\{existing \? 'Edit record' : 'Add record'\} subtitle=\{recordContext\} onClose=\{onClose\}>/, 'Income and Expense edits must pass their record identity into the sticky modal header.');
assert.match(transformedApp, /function SimpleModal\(\{ title, subtitle = '', onClose, children, wide = false \}\)/, 'SimpleModal must accept the optional record identity without affecting other modal users.');
assert.match(transformedApp, /\{subtitle && <div className="modal-context">\{subtitle\}<\/div>\}/, 'The record identity must stay visible in the sticky editor header while scrolling.');

console.log('Penny mobile viewport, compact header, transfer plan, and shared Income/Expense editor regressions passed');
