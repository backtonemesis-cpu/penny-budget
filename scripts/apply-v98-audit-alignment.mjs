import { readFile, writeFile } from 'node:fs/promises';

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

console.log('PENNY_V98 accessibility audit alignment applied');
