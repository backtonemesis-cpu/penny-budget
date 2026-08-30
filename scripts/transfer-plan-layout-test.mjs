import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/transfer-plan-compact.css', import.meta.url), 'utf8');

assert.match(css, /\.attention-card \.section-heading \.section-note \{\s*display: none;/s, 'Transfer-plan explanatory copy must remain hidden.');
assert.match(css, /\.attention-card \.transfer-account-row > \.money,[\s\S]*\.attention-card \.transfer-breakdown,[\s\S]*\.attention-card \.funding-balance-editor small \{\s*display: none !important;/s, 'Duplicate transfer amount, payer pills and helper copy must stay hidden.');
assert.match(css, /\.attention-card \.transfer-account-row > \.grow > \.muted \{\s*display: none;/s, 'Duplicate account-owner text must stay hidden.');
assert.match(css, /\.attention-card \.transfer-account-row > \.grow \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/s, 'Desktop transfer summary must use three uniform columns.');
assert.match(css, /\.attention-card \.funding-math > span:nth-child\(2\) \{\s*display: none;/s, 'Read-only current-balance duplicate must stay hidden.');
assert.match(css, /\.attention-card \.funding-balance-editor \{[\s\S]*grid-column: 2;[\s\S]*border: 1px solid var\(--border-soft\);[\s\S]*background: var\(--surface-2\);/s, 'Editable current balance must occupy the middle themed summary card.');
assert.match(css, /\.attention-card \.funding-balance-editor input \{[\s\S]*background: transparent;[\s\S]*text-align: right;/s, 'Current balance input must be integrated into its Penny summary card.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.attention-card \.funding-balance-editor \{[\s\S]*grid-row: 3;/s, 'Mobile current balance must sit between planned costs and transfer needed.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.attention-card \.funding-math > span:last-child \{[\s\S]*grid-row: 4;/s, 'Mobile transfer-needed row must follow the editable current balance.');

console.log('Penny transfer-plan layout regression passed.');
