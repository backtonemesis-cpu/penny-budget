import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/apply-v98-ui-cleanup.mjs';
let source = await readFile(path, 'utf8');

const broadIncome = `/\\<div className="record-meta assignment-line"\\>Received by[\\s\\S]*?onAssign=\\{\\(value\\) => onAssignIncome\\(record, 'account', value\\)\\} \\/\\>\\<\\/div\\>/`;
const safeIncome = `/\\<div className="record-meta assignment-line"\\>Received by[^\\n]*?onAssign=\\{\\(value\\) => onAssignIncome\\(record, 'account', value\\)\\} \\/\\>\\<\\/div\\>/`;
const broadExpense = `/\\<div className="record-meta assignment-line"\\>Paid by[\\s\\S]*?onAssign=\\{\\(value\\) => onAssign\\(transaction, 'account', value\\)\\} \\/\\>\\<\\/div\\>/`;
const safeExpense = `/\\<div className="record-meta assignment-line"\\>Paid by[^\\n]*?onAssign=\\{\\(value\\) => onAssign\\(transaction, 'account', value\\)\\} \\/\\>\\<\\/div\\>/`;

// The literals in the transform do not include escaped angle brackets in source,
// so also handle their direct textual form.
const pairs = [
  [`/<div className="record-meta assignment-line">Received by[\\s\\S]*?onAssign=\\{\\(value\\) => onAssignIncome\\(record, 'account', value\\)\\} \\/><\\/div>/`, `/<div className="record-meta assignment-line">Received by[^\\n]*?onAssign=\\{\\(value\\) => onAssignIncome\\(record, 'account', value\\)\\} \\/><\\/div>/`],
  [`/<div className="record-meta assignment-line">Paid by[\\s\\S]*?onAssign=\\{\\(value\\) => onAssign\\(transaction, 'account', value\\)\\} \\/><\\/div>/`, `/<div className="record-meta assignment-line">Paid by[^\\n]*?onAssign=\\{\\(value\\) => onAssign\\(transaction, 'account', value\\)\\} \\/><\\/div>/`],
  [broadIncome, safeIncome],
  [broadExpense, safeExpense],
];

let changed = false;
for (const [before, after] of pairs) {
  if (source.includes(before)) {
    source = source.replace(before, after);
    changed = true;
  }
}
if (!changed && !source.includes(`Received by[^\\n]*?onAssign`) && !source.includes(`Paid by[^\\n]*?onAssign`)) {
  throw new Error('prepare-v98 could not find card regex anchors');
}
await writeFile(path, source);
console.log('v98 card transforms scoped to individual JSX rows');
