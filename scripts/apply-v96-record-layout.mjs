import { readFile, writeFile } from 'node:fs/promises';

const path = 'build/record-date-layout.js';
let text = await readFile(path, 'utf8');

const oldIncomeSearch = `  const incomeStart = output.indexOf(incomeMarker, nextRecordModalStart);\n  // v95 uses one shared text field labelled Income type for income records, so\n  // the Income branch itself begins with Received By / Account. Keep Exact date\n  // immediately before that assignment grid without requiring a second type field.\n  const receivedGridPos = output.indexOf('<div className="form-grid">', incomeStart);\n  if (receivedGridPos < 0) fail('Could not find Received By / Account in the Income branch.');\n  const incomeInsert = lineStart(output, receivedGridPos);\n  output = output.slice(0, incomeInsert)\n    + conditionalDateBlock('income', dateBlock)\n    + output.slice(incomeInsert);`;

const newIncomeSearch = `  const incomeStart = output.indexOf(incomeMarker, nextRecordModalStart);\n  // v96 uses one owner-labelled destination account selector for income.\n  // Keep Exact date immediately before that selector.\n  const receivedAccountPos = output.indexOf('<ReferenceSelect id="income-account"', incomeStart);\n  if (receivedAccountPos < 0) fail('Could not find Received into account in the Income branch.');\n  const incomeInsert = lineStart(output, receivedAccountPos);\n  output = output.slice(0, incomeInsert)\n    + conditionalDateBlock('income', dateBlock)\n    + output.slice(incomeInsert);`;

if (!text.includes(newIncomeSearch)) {
  if (!text.includes(oldIncomeSearch)) throw new Error('v96 record layout missing v95 Income selector anchor');
  text = text.replace(oldIncomeSearch, newIncomeSearch);
}

const oldAssert = `  const finalIncomeStart = modal.indexOf(incomeMarker);\n  const finalIncomeDate = modal.indexOf(exactDateLabel, finalIncomeStart);\n  const finalReceivedBy = modal.indexOf('label="Received By"', finalIncomeDate);\n  if (!(finalIncomeStart >= 0 && finalIncomeDate > finalIncomeStart && finalReceivedBy > finalIncomeDate)) {\n    fail('Income Exact date controls are not before Received By / Account.');\n  }`;
const newAssert = `  const finalIncomeStart = modal.indexOf(incomeMarker);\n  const finalIncomeDate = modal.indexOf(exactDateLabel, finalIncomeStart);\n  const finalReceivedAccount = modal.indexOf('label="Received into account"', finalIncomeDate);\n  if (!(finalIncomeStart >= 0 && finalIncomeDate > finalIncomeStart && finalReceivedAccount > finalIncomeDate)) {\n    fail('Income Exact date controls are not before Received into account.');\n  }`;
if (!text.includes(newAssert)) {
  if (!text.includes(oldAssert)) throw new Error('v96 record layout missing v95 Income order assertion');
  text = text.replace(oldAssert, newAssert);
}

await writeFile(path, text);
console.log('PENNY_V96 record-date layout aligned with single income account selector');
