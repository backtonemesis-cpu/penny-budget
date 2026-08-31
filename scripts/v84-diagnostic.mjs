import { readFile } from 'node:fs/promises';
const app = await readFile('src/App.jsx', 'utf8');
for (const needle of ['<Transactions', '<ExpenseRow', 'function Transactions', 'function ExpenseRow', 'function AssignmentValue', 'Received by <AssignmentValue', 'assignment-line"><AssignmentValue']) {
  let index = app.indexOf(needle);
  while (index >= 0) {
    console.log(`V84_DIAGNOSTIC ${needle}:\n${app.slice(Math.max(0, index - 160), index + 1300)}\nEND_V84_DIAGNOSTIC`);
    index = app.indexOf(needle, index + needle.length);
  }
}
