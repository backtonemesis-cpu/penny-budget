import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [main, css] = await Promise.all([
  readFile('src/main.jsx', 'utf8'),
  readFile('src/transaction-uniform.css', 'utf8'),
]);

assert.doesNotMatch(main, /installAttentionNavigation|attention-navigation/, 'The removed attention navigation feature must not be loaded.');
assert.match(main, /transaction-uniform\.css/, 'The uniform transaction stylesheet must be loaded.');
assert.match(css, /\.compact-overview-warning\s*\{[^}]*display:\s*none\s*!important/s, 'The Overview attention banner must remain hidden.');
assert.match(css, /section\[aria-labelledby="expenses-list-title"\][\s\S]*\.record-side[\s\S]*grid-template-columns:\s*1fr/, 'Expense rows must reserve a separate mobile layout area for the amount and actions.');
assert.match(css, /\.record-side > \.mini-actions[\s\S]*grid-template-columns:/, 'Mobile transaction actions must use a stable grid rather than being pushed by amount width.');
assert.match(css, /\.record-side > \.money[\s\S]*white-space:\s*nowrap/, 'Transaction amounts must remain intact without wrapping into the controls.');

console.log('transaction uniform layout regression passed');
