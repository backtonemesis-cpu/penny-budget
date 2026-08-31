import { readFile, writeFile } from 'node:fs/promises';

// Update source audits to the deliberately simplified account-derived ownership UI.
const auditPath = 'scripts/source-audit.mjs';
let audit = await readFile(auditPath, 'utf8');

const oldPaidByAudit = `  assert.match(files.app, /label="Paid By"/);`;
const newPaidByAudit = `  assert.match(files.app, /label="Paid from account"/, 'Expense must expose the owner-labelled payment account selector to assistive technology.');\n  assert.doesNotMatch(files.app, /label="Paid By"/, 'Expense must not expose a redundant second payer selector.');`;
if (!audit.includes(newPaidByAudit)) {
  if (!audit.includes(oldPaidByAudit)) throw new Error('v98 audit alignment missing Paid By source-audit anchor');
  audit = audit.replace(oldPaidByAudit, newPaidByAudit);
}

const oldIncomeAssignmentAudit = `  assert.match(files.app, /onAssignIncome\\(record, 'receivedBy', value\\)/, 'Income Detail must expose an actionable recipient assignment.');`;
const newIncomeAssignmentAudit = `  assert.match(files.app, /onAssignIncome\\(record, 'account', value\\)/, 'Income Detail must expose an actionable receiving-account assignment.');\n  assert.match(files.app, /draft\\.receivedBy = ownerId/, 'Income recipient evidence must be derived from the selected account owner.');`;
if (audit.includes(oldIncomeAssignmentAudit)) audit = audit.replace(oldIncomeAssignmentAudit, newIncomeAssignmentAudit);

const oldExpenseAssignmentAudit = `  assert.match(files.app, /onAssign\\(transaction, 'paidBy', value\\)/, 'Expense Detail must expose an actionable payer assignment.');`;
const newExpenseAssignmentAudit = `  assert.match(files.app, /onAssign\\(transaction, 'account', value\\)/, 'Expense Detail must expose an actionable payment-account assignment.');\n  assert.match(files.app, /draft\\.paidBy = ownerId/, 'Expense payer evidence must be derived from the selected account owner.');`;
if (audit.includes(oldExpenseAssignmentAudit)) audit = audit.replace(oldExpenseAssignmentAudit, newExpenseAssignmentAudit);

await writeFile(auditPath, audit);
console.log('PENNY_V98 accessibility and finance audit alignment applied');
