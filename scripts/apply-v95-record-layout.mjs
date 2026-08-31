import { readFile, writeFile } from 'node:fs/promises';

const path = 'build/record-date-layout.js';
let text = await readFile(path, 'utf8');
// The legacy build helper is checked in with CRLF. Normalise only this source
// helper before applying the small v95 compatibility change.
text = text.replace(/\r\n/g, '\n');

const oldIncomeBlock = `  const incomeStart = output.indexOf(incomeMarker, nextRecordModalStart);\n  const incomeTypeLabel = '<label htmlFor="income-type">Income type</label>';\n  const incomeTypePos = output.indexOf(incomeTypeLabel, incomeStart);\n  if (incomeTypePos < 0) fail('Could not find the Income type field.');\n  const receivedGridPos = output.indexOf('<div className="form-grid">', incomeTypePos);\n  if (receivedGridPos < 0) fail('Could not find Received By / Account after Income type.');\n  const incomeInsert = lineStart(output, receivedGridPos);\n  output = output.slice(0, incomeInsert)\n    + conditionalDateBlock('income', dateBlock)\n    + output.slice(incomeInsert);`;

const newIncomeBlock = `  const incomeStart = output.indexOf(incomeMarker, nextRecordModalStart);\n  // v95 uses one shared text field labelled Income type for income records, so\n  // the Income branch itself begins with Received By / Account. Keep Exact date\n  // immediately before that assignment grid without requiring a second type field.\n  const receivedGridPos = output.indexOf('<div className="form-grid">', incomeStart);\n  if (receivedGridPos < 0) fail('Could not find Received By / Account in the Income branch.');\n  const incomeInsert = lineStart(output, receivedGridPos);\n  output = output.slice(0, incomeInsert)\n    + conditionalDateBlock('income', dateBlock)\n    + output.slice(incomeInsert);`;

if (!text.includes(newIncomeBlock)) {
  if (!text.includes(oldIncomeBlock)) throw new Error('v95 record layout missing old Income field anchor');
  text = text.replace(oldIncomeBlock, newIncomeBlock);
}

const oldAssert = `  assertBranchOrder(modal, incomeMarker, incomeTypeLabel, exactDateLabel, 'label="Received By"', 'Income');`;
const newAssert = `  const finalIncomeStart = modal.indexOf(incomeMarker);\n  const finalIncomeDate = modal.indexOf(exactDateLabel, finalIncomeStart);\n  const finalReceivedBy = modal.indexOf('label="Received By"', finalIncomeDate);\n  if (!(finalIncomeStart >= 0 && finalIncomeDate > finalIncomeStart && finalReceivedBy > finalIncomeDate)) {\n    fail('Income Exact date controls are not before Received By / Account.');\n  }`;
if (!text.includes(newAssert)) {
  if (!text.includes(oldAssert)) throw new Error('v95 record layout missing old Income order assertion');
  text = text.replace(oldAssert, newAssert);
}

if (text.includes('incomeTypeLabel')) throw new Error('v95 record layout still depends on the removed second Income type field');
await writeFile(path, text);
console.log('PENNY_V95 single-field Income record-date layout applied');
