import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { moneyValidationMessage, normaliseComparableLabel, validateMoneyInput } from '../src/money-input.js';

const precise = validateMoneyInput('1234.56');
assert.equal(precise.ok, true, 'normal penny amount must be accepted');
assert.equal(precise.value, 1234.56, 'accepted amount must retain exact penny value');

const subPenny = validateMoneyInput('0.001');
assert.equal(subPenny.ok, false);
assert.equal(subPenny.code, 'precision', 'sub-penny input must be rejected specifically for precision');
assert.match(moneyValidationMessage(subPenny), /no more than 2 decimal places/i);

const unsafe = validateMoneyInput('9999999999999999.99');
assert.equal(unsafe.ok, false);
assert.equal(unsafe.code, 'unsafe', 'unsafe Number precision must be blocked before conversion');
assert.match(moneyValidationMessage(unsafe), /too large to store safely to the penny/i);

const maxSafe = validateMoneyInput('90071992547409.91');
assert.equal(maxSafe.ok, true, 'largest safe penny value must remain accepted');
assert.equal(maxSafe.pence, 9007199254740991n);

const overSafe = validateMoneyInput('90071992547409.92');
assert.equal(overSafe.ok, false, 'one penny beyond Number safe integer must be rejected');
assert.equal(overSafe.code, 'unsafe');

const negative = validateMoneyInput('-100', { allowZero: true });
assert.equal(negative.ok, false);
assert.equal(negative.code, 'negative');
assert.match(moneyValidationMessage(negative, 'Balance'), /Balance cannot be negative/);

assert.equal(normaliseComparableLabel('  School   Meals  '), 'school meals');
assert.equal(normaliseComparableLabel('SCHOOL MEALS'), 'school meals');

const app = await readFile('src/App.jsx', 'utf8');
assert.match(app, /moneyValidationMessage\(amountCheck, 'Amount'\)/, 'record editor must use field-specific exact-money validation');
assert.match(app, /normaliseComparableLabel\(category\.label\) === normaliseComparableLabel\(label\)/, 'new category duplicates must be blocked after whitespace/case normalisation');
assert.match(app, /A category named “/, 'duplicate category must show explicit feedback');
assert.match(app, /moneyValidationMessage\(balanceCheck, 'Balance'\)/, 'savings balance must show explicit invalid-value feedback');
assert.match(app, /aria-invalid=\{Boolean\(balanceError\)\}/, 'invalid savings balance must be exposed accessibly');
assert.match(app, /moneyValidationMessage\(check, label\)/, 'savings goal/contribution must have field-specific validation');
assert.match(app, /Savings snapshot is separate: if you switch it off/, 'month setup must explain that savings account definitions are omitted with the snapshot');
assert.match(app, /account definitions were intentionally not copied/, 'Savings empty state must explain the setup consequence');

console.log('v88 financial validation regression passed');
