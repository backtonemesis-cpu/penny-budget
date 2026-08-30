import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [incomeCss, expenseCss, main] = await Promise.all([
  readFile('src/income-compact.css', 'utf8'),
  readFile('src/expense-income-parity.css', 'utf8'),
  readFile('src/main.jsx', 'utf8'),
]);

assert.match(main, /import '\.\/expense-income-parity\.css';/, 'Parity CSS must load after the existing transaction styles.');
assert.match(expenseCss, /section\[aria-labelledby="expenses-list-title"\] \.record-icon \{\s*display: none;/, 'Expense list icons must not consume a separate column when matching Income.');

const requiredListGeometry = [
  'grid-template-columns: minmax(0, 1fr) auto;',
  'gap: 6px 10px;',
  'padding: 10px 0;',
  'font-size: 15px;',
  'line-height: 1.18;',
  'font-size: 11px;',
  'line-height: 1.28;',
  'display: contents;',
  'grid-column: 2;',
  'grid-row: 1;',
  'font-size: 18px;',
  'grid-template-columns: minmax(0, 1fr) auto auto;',
  'min-height: 38px;',
];
for (const token of requiredListGeometry) {
  assert.ok(incomeCss.includes(token), `Income reference geometry missing ${token}`);
  assert.ok(expenseCss.includes(token), `Expense list geometry must mirror Income: ${token}`);
}

const requiredDetailGeometry = [
  'grid-template-columns: minmax(0, 1fr) auto;',
  'gap: 4px 10px;',
  'padding: 10px 0;',
  'font-size: 15px;',
  'line-height: 1.15;',
  'font-size: 10.5px;',
  'line-height: 1.3;',
  'display: contents;',
  'grid-column: 2;',
  'grid-row: 1;',
  'font-size: 18px;',
  'grid-template-columns: minmax(0, 1fr) auto auto;',
  'min-height: 34px;',
];
for (const token of requiredDetailGeometry) {
  assert.ok(expenseCss.includes(token), `Expense Detail must use Income Detail geometry: ${token}`);
}

assert.match(expenseCss, /white-space: nowrap;/, 'Large expense amounts must stay on one line without displacing actions.');
assert.match(expenseCss, /@media \(max-width: 390px\)/, 'Small-phone parity rules must be preserved.');

console.log('Expense and Income mobile visual parity regression passed.');
