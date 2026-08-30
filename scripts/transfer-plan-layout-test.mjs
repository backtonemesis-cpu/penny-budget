import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/transfer-plan-compact.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

assert.match(css, /\.attention-card \.section-heading \.section-note \{\s*display: none;/s, 'Transfer-plan explanatory copy must remain hidden.');
assert.match(css, /\.attention-card \.section-heading > div:first-child \{[\s\S]*grid-column: 1;/s, 'Desktop transfer-plan title must sit in the left header column.');
assert.match(css, /\.attention-card \.section-heading \.section-title \{[\s\S]*font-size: 17px;[\s\S]*white-space: nowrap;/s, 'Desktop transfer-plan title must remain compact and single-line.');
assert.match(css, /\.attention-card \.transfer-account-row > \.grow \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[\s\S]*grid-template-rows: auto auto;/s, 'Desktop transfer summary must use one aligned three-card row beneath the account title.');
assert.match(css, /\.attention-card \.funding-math > span:first-child \{[\s\S]*grid-column: 1;[\s\S]*grid-row: 2;/s, 'Desktop planned costs must occupy the first summary card.');
assert.match(css, /\.attention-card \.funding-balance-editor \{[\s\S]*grid-column: 2;[\s\S]*grid-row: 2;[\s\S]*border: 1px solid var\(--border-soft\);[\s\S]*background: var\(--surface-2\);/s, 'Desktop editable current balance must align with the other summary cards.');
assert.match(css, /\.attention-card \.funding-math > span:last-child \{[\s\S]*grid-column: 3;[\s\S]*grid-row: 2;/s, 'Desktop transfer-needed value must occupy the third aligned summary card.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.attention-card \.section-heading > div:first-child \{[\s\S]*grid-column: 1 \/ -1;/s, 'Mobile title must retain its existing full-width row.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.attention-card \.section-heading \.section-title \{[\s\S]*font-size: clamp\(13px, 3\.65vw, 15px\);[\s\S]*white-space: nowrap;/s, 'Mobile transfer-plan title must stay unchanged and compact.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.attention-card \.section-heading > div:last-child \.money \{[\s\S]*font-size: clamp\(28px, 8vw, 34px\);/s, 'Mobile transfer-needed total must remain visually prominent.');
assert.ok(main.indexOf("import './overview-compact-v12.css';") < main.indexOf("import './transfer-plan-compact.css';"), 'Transfer-plan CSS must load after Overview CSS so the compact header cannot be overridden.');
assert.match(css, /\.attention-card \.transfer-account-row > \.money,[\s\S]*\.attention-card \.transfer-breakdown,[\s\S]*\.attention-card \.funding-balance-editor small \{\s*display: none !important;/s, 'Duplicate transfer amount, payer pills and helper copy must stay hidden.');
assert.match(css, /\.attention-card \.transfer-account-row > \.grow > \.muted \{\s*display: none;/s, 'Duplicate account-owner text must stay hidden.');
assert.match(css, /\.attention-card \.funding-math > span:nth-child\(2\) \{\s*display: none;/s, 'Read-only current-balance duplicate must stay hidden.');
assert.match(css, /\.attention-card \.funding-balance-editor input \{[\s\S]*background: transparent;[\s\S]*text-align: right;/s, 'Current balance input must remain integrated into its Penny summary card.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.attention-card \.funding-balance-editor \{[\s\S]*grid-row: 3;/s, 'Mobile current balance must remain between planned costs and transfer needed.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.attention-card \.funding-math > span:last-child \{[\s\S]*grid-row: 4;/s, 'Mobile transfer-needed row must remain after the editable current balance.');

console.log('Penny transfer-plan layout regression passed.');
