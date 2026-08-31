import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');
const styles = await readFile('src/styles.css', 'utf8');

assert.match(app, /PENNY_V99_EXPLICIT_INPUTS/, 'v99 marker must be present after postinstall');
assert.doesNotMatch(app, />Select owner<\/option>/, 'Owner must not display a placeholder value');
assert.match(app, /<option value="" disabled hidden><\/option>/, 'Blank native select state must remain non-selectable');
assert.match(app, /blankWhenUnassigned/, 'Account selectors must support a visually blank unassigned state');
assert.match(app, /label="Received into account"[^>]*blankWhenUnassigned/, 'Income account must start visually blank');
assert.match(app, /label="Paid from account"[^>]*blankWhenUnassigned/, 'Expense account must start visually blank');

assert.match(app, /useState\(income\?\.incomeStatus \|\| ''\)/, 'New income status must start blank');
assert.match(app, /useState\(transaction \? Boolean\(transaction\.paid\) : null\)/, 'New payment status must start blank');
assert.match(app, /useState\(transaction\?\.expenseClass \|\| ''\)/, 'New expense type must start blank');
assert.match(app, /Choose whether this income is Expected or Received\./, 'Income status must be an explicit required choice');
assert.match(app, /Choose whether this expense is Fixed or Variable\./, 'Expense type must be an explicit required choice');
assert.match(app, /Choose whether this expense is Paid or Unpaid\./, 'Payment status must be an explicit required choice');

assert.doesNotMatch(app, /<option value="">Select category<\/option>/, 'Expense category must not show a Select category placeholder');
assert.match(app, /className="field category-picker"/, 'Expense category must use the contained Penny picker');
assert.match(app, /role="listbox"/, 'Contained category picker must expose listbox semantics');
assert.match(styles, /\.category-options[\s\S]*max-height:\s*260px[\s\S]*overflow-y:\s*auto/, 'Category choices must scroll inside the modal');

assert.doesNotMatch(app, /type="number"[^>]*inputMode="decimal"/, 'No money field may use browser number-spinner controls');
assert.match(app, /function NumberField[\s\S]*type="text" inputMode="decimal"/, 'Savings goal and contribution must use direct decimal entry');
assert.match(app, /function FundingBalanceEditor[\s\S]*type="text"[\s\S]*inputMode="decimal"/, 'Transfer current balance must use direct decimal entry');
assert.match(styles, /\.savings-edit-input,[\s\S]*background:\s*var\(--surface-2\) !important/, 'Savings balance editor must visually match Penny inputs');

assert.match(app, /savingsGoalProgress\(state\.savingsGoal, summary\.currentSavings, state\.savingsContrib\)/, 'Savings goal UI must use the audited projection helper');
assert.match(app, /filter\(\(issue\) => issue !== 'date'\)/, 'Date-only confirmation must be suppressed from persistent save banners');

console.log('v99 explicit input UX regression passed');
