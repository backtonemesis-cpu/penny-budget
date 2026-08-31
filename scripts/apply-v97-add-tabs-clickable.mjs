import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

// v96 introduced switchAddMode as a const below the early-return People and
// Accounts branches. Those branches return before the const is initialised, so
// their tab click handlers close over a permanently-uninitialised binding and
// throw when Accounts / Income / Expense is clicked. A function declaration is
// hoisted and initialised for the whole RecordModal invocation, so the same
// handlers remain safe even when the current branch returns early.
const startToken = `  const switchAddMode = (nextMode) => {`;
const saveToken = `\n\n  const save = () => {`;
const start = app.indexOf(startToken, app.indexOf('function RecordModal('));
const save = app.indexOf(saveToken, start);

if (start >= 0) {
  if (save < 0) throw new Error('v97 could not isolate switchAddMode helper');
  const block = app.slice(start, save);
  if (!block.endsWith(`\n  };`)) throw new Error('v97 switchAddMode helper had an unexpected ending');
  const hoisted = block
    .replace(startToken, `  function switchAddMode(nextMode) {`)
    .slice(0, -5) + `\n  }`;
  app = app.slice(0, start) + hoisted + app.slice(save);
}

if (!app.includes('function switchAddMode(nextMode) {')) throw new Error('v97 hoisted switchAddMode missing');
if (app.includes('const switchAddMode = (nextMode) =>')) throw new Error('v97 unhoisted switchAddMode still present');
for (const mode of ['people', 'account', 'income', 'expense']) {
  if (!app.includes(`switchAddMode('${mode}')`)) throw new Error(`v97 ${mode} tab does not use switchAddMode`);
}

if (app.includes('PENNY_V96_ADD_FORM_STATE') && !app.includes('PENNY_V97_ADD_TABS_CLICKABLE')) {
  app = app.replace('PENNY_V96_ADD_FORM_STATE', 'PENNY_V96_ADD_FORM_STATE PENNY_V97_ADD_TABS_CLICKABLE');
}

await writeFile(appPath, app);
console.log('PENNY_V97 Add tabs remain clickable from People and Accounts');
