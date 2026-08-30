import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/apply-v40-savings-accounts.mjs';
const before = await readFile(path, 'utf8');
const after = before.replaceAll('\\\\${', '\\${');
if (after !== before) await writeFile(path, after);
