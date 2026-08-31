import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

assert.match(app, /PENNY_V97_ADD_TABS_CLICKABLE/, 'v97 marker must be present after postinstall');
assert.match(app, /function switchAddMode\(nextMode\) \{/, 'Add-mode switch must be a hoisted function declaration');
assert.doesNotMatch(app, /const switchAddMode = \(nextMode\) =>/, 'Add-mode switch must not be an uninitialised const below early-return branches');

const peopleBranch = app.indexOf("if (!lockedMode && mode === 'people')");
const accountBranch = app.indexOf("if (!lockedMode && mode === 'account')", peopleBranch);
const switchHelper = app.indexOf('function switchAddMode(nextMode) {');
assert.ok(peopleBranch >= 0 && accountBranch > peopleBranch && switchHelper > accountBranch,
  'Regression must cover the early-return People/Accounts branches that appear before the switch helper');

for (const mode of ['people', 'account', 'income', 'expense']) {
  assert.match(app, new RegExp(`switchAddMode\\('${mode}'\\)`), `${mode} Add tab must remain wired to the shared switch handler`);
}

console.log('Penny v97 Add-tab clickability regression passed');
