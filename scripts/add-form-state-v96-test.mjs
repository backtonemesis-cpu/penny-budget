import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');
const recordStart = app.indexOf('function RecordModal(');
const refStart = app.indexOf('\nfunction ReferenceSelect(', recordStart);
assert.ok(recordStart >= 0 && refStart > recordStart, 'RecordModal must exist');
const modal = app.slice(recordStart, refStart);

assert.match(app, /PENNY_V96_ADD_FORM_STATE/, 'v96 marker must be present');
assert.match(modal, /initialDateConfirmed = existing \? !existingIssues\.includes\('date'\) : false/, 'new records must start with an unconfirmed date');
assert.match(modal, /useState\(existing && initialDateConfirmed \? existing\.date : ''\)/, 'new record date must start blank');
assert.match(modal, /id="record-amount" type="text" inputMode="decimal"/, 'amount must use a plain decimal text box without number spinners');
assert.doesNotMatch(modal, /id="record-amount" type="number"/, 'amount must not use browser number spinner controls');
assert.match(modal, /const switchAddMode = \(nextMode\) =>/, 'Add tabs must use independent draft reset logic');
assert.match(modal, /setDescription\(''\);[\s\S]*setAmount\(''\);[\s\S]*setDateConfirmed\(false\);[\s\S]*setAccount\('unassigned'\)/, 'switching Add tabs must clear shared draft state');
assert.doesNotMatch(modal, /if \(!incomeType\.trim\(\)\)/, 'removed second Income type state must not block saving');
assert.match(modal, /incomeType: description/, 'the visible Income type field must be the value stored as incomeType');
assert.doesNotMatch(modal, /label="Received By"/, 'Income must not render a separate Received By selector');
assert.match(modal, /label="Received into account"/, 'Income must use one owner-labelled destination account selector');
assert.match(modal, /const resolvedReceivedBy = selectedIncomeAccount\?\.ownerId/, 'Income recipient must be derived from the selected account owner');

const peopleStart = modal.indexOf("if (!lockedMode && mode === 'people')");
const accountStart = modal.indexOf("if (!lockedMode && mode === 'account')", peopleStart);
assert.ok(peopleStart >= 0 && accountStart > peopleStart, 'People and Account Add modes must exist');
const peopleBlock = modal.slice(peopleStart, accountStart);
assert.doesNotMatch(peopleBlock, /added to this month\./, 'People must not show an added confirmation banner');

const accountEnd = modal.indexOf('const switchAddMode = (nextMode)', accountStart);
const accountBlock = modal.slice(accountStart, accountEnd);
assert.match(accountBlock, /const removeAccountFromHub = \(item\) =>/, 'Accounts must provide safe removal');
assert.match(accountBlock, />Remove<\/button>/, 'Account list must render Remove controls');
assert.match(accountBlock, /SET_SAVINGS_ACCOUNTS/, 'Savings account removal must update the month savings definitions');
assert.match(accountBlock, /field: 'accounts'/, 'Bank\/card account removal must update the month account definitions');
assert.match(accountBlock, /disabled=\{accountInUse\(item\)\}/, 'in-use current-month accounts must be protected from removal');

console.log('Penny v96 Add form state, account removal, blank date and income ownership regressions passed');
