import { readFile } from 'node:fs/promises';
const app = await readFile('src/App.jsx', 'utf8');
for (const needle of ['<Transactions', '<ExpenseRow']) {
  let index = app.indexOf(needle);
  while (index >= 0) {
    console.log(`V84_DIAGNOSTIC ${needle}:\n${app.slice(Math.max(0, index - 120), index + 900)}\nEND_V84_DIAGNOSTIC`);
    index = app.indexOf(needle, index + needle.length);
  }
}
