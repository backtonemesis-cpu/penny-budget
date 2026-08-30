import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [driver, css, main] = await Promise.all([
  readFile('scripts/apply-v38-savings-detail.mjs', 'utf8'),
  readFile('src/savings-detail-parity.css', 'utf8'),
  readFile('src/main.jsx', 'utf8'),
]);

assert.match(driver, /onSavingsDetails=\{\(\) => setView\('Savings'\)\}/, 'Overview Savings must open the Savings view directly.');
assert.match(driver, /onClick=\{onSavingsDetails\}/, 'Savings Snapshot hero must be actionable.');
assert.match(driver, /PENNY_V38_SAVINGS_ROW/, 'Savings rows must use the compact detail presentation.');
assert.match(driver, /record-title/, 'Savings account name must use the same record-title structure as Income/Expenses.');
assert.match(driver, /money green/, 'Savings balance must use the standard aligned money position.');
assert.match(driver, /formatMoney\(account\.balance\)/, 'Savings balances must display as formatted currency rather than raw input numbers.');
assert.match(driver, />Edit</, 'Savings must retain explicit edit access.');
assert.match(driver, />Delete</, 'Savings must retain delete access.');
assert.match(driver, />Save</, 'Savings edit mode must use an explicit save action.');
assert.match(driver, />Cancel</, 'Savings edit mode must support cancelling without changing the stored snapshot.');
assert.match(main, /import '\.\/savings-detail-parity\.css';/, 'Savings parity CSS must be loaded.');

const sharedGeometry = [
  'gap: 4px 10px;',
  'padding: 10px 0;',
  'font-size: 15px;',
  'line-height: 1.15;',
  'font-size: 10.5px;',
  'line-height: 1.3;',
  'grid-column: 2;',
  'grid-row: 1;',
  'font-size: 18px;',
  'white-space: nowrap;',
  'min-height: 34px;',
];
for (const token of sharedGeometry) {
  assert.ok(css.includes(token), `Savings layout must retain Income/Expense detail geometry: ${token}`);
}

assert.match(css, /@media \(max-width: 390px\)/, 'Savings must retain narrow-phone layout rules.');
assert.match(css, /savings-edit-fields/, 'Savings edit mode must remain compact rather than reverting to full-width stacked forms.');
assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(118px, 42%\);/, 'Savings heading must reserve an in-card mobile action column.');
assert.match(css, /> \.section-heading > \.primary-button \{[\s\S]*?width: 100%;[\s\S]*?max-width: 100%;[\s\S]*?min-width: 0;/, 'Savings Add Account button must be constrained to the heading column instead of overflowing the card.');
assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(122px, 42%\);/, 'Narrow phones must keep enough width for Add Account without escaping the card.');

console.log('Savings detail, Overview navigation and mobile containment regression passed.');
