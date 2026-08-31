import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/source-audit.mjs';
let source = await readFile(path, 'utf8');
const before = "  assert.match(files.app, /Every bill-paying account has an explicit owner/);";
const after = "  assert.match(files.app, /Choose who owns this account\./, 'Account creation must still require explicit ownership evidence after moving setup out of Settings.');";
if (source.includes(before)) source = source.replace(before, after);
else if (!source.includes(after)) throw new Error('v93 finance-audit ownership anchor missing.');
await writeFile(path, source);
console.log('PENNY_V93 finance audit aligned with Add-based account ownership');
