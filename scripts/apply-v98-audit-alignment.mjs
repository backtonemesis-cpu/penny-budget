import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/App.jsx';
let app = await readFile(appPath, 'utf8');

// Payer / recipient now comes from the selected account, so transaction cards
// must show all month accounts. The owner-labelled option itself is the evidence.
const filteredChoices = /const accountChoicesFor = \(personId\) => \(accountOptions \|\| \[\]\)\.filter\(\(account\) => \{[\s\S]*?\n  \}\);/;
const allChoices = `const accountChoicesFor = () => (accountOptions || []).filter((account) => account && account.id !== 'unassigned');`;
if (!app.includes(allChoices)) {
  if (!filteredChoices.test(app)) throw new Error('v98 audit alignment missing accountChoicesFor helper');
  app = app.replace(filteredChoices, allChoices);
}
await writeFile(appPath, app);

// Update the source accessibility audit to the deliberately simplified UI.
const auditPath = 'scripts/source-audit.mjs';
let audit = await readFile(auditPath, 'utf8');
const oldPaidByAudit = `  assert.match(files.app, /label="Paid By"/);`;
const newPaidByAudit = `  assert.match(files.app, /label="Paid from account"/, 'Expense must expose the owner-labelled payment account selector to assistive technology.');\n  assert.doesNotMatch(files.app, /label="Paid By"/, 'Expense must not expose a redundant second payer selector.');`;
if (!audit.includes(newPaidByAudit)) {
  if (!audit.includes(oldPaidByAudit)) throw new Error('v98 audit alignment missing Paid By source-audit anchor');
  audit = audit.replace(oldPaidByAudit, newPaidByAudit);
}
await writeFile(auditPath, audit);

console.log('PENNY_V98 accessibility audit and full account-choice alignment applied');
