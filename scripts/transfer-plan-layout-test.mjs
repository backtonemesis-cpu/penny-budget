import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/transfer-plan-compact.css', import.meta.url), 'utf8');

assert.match(css, /\.attention-card \.section-heading \.section-note \{\s*display: none;/s, 'Transfer-plan explanatory copy must remain hidden.');
assert.match(css, /\.attention-card \.transfer-account-row > \.money,[\s\S]*\.attention-card \.transfer-breakdown \{\s*display: none !important;/s, 'Duplicate transfer amount and payer pills must stay hidden.');
assert.match(css, /\.attention-card \.transfer-account-row > \.grow > \.muted \{\s*display: none;/s, 'Duplicate account-owner text must stay hidden.');
assert.match(css, /\.attention-card \.funding-math \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/s, 'Desktop transfer figures must use a uniform three-column summary.');
assert.match(css, /\.attention-card \.funding-balance-editor input \{[\s\S]*border-radius: 12px;[\s\S]*background: var\(--surface-2\);/s, 'Current balance input must use Penny theme styling.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.attention-card \.funding-math \{[\s\S]*grid-template-columns: 1fr;/s, 'Mobile transfer figures must stack cleanly.');

console.log('Penny transfer-plan layout regression passed.');
