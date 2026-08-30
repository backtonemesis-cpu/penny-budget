import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

assert.match(main, /visibilitychange/, 'Penny must recheck releases when the installed app becomes visible again.');
assert.match(main, /pageshow/, 'Penny must recheck releases when a suspended page resumes.');
assert.match(main, /addEventListener\('focus'/, 'Penny must recheck releases when the app regains focus.');
assert.match(main, /cache: 'no-store'/, 'Release checks must bypass HTTP cache.');
assert.match(main, /__PENNY_RELEASE__/, 'The verified running release must be available to the UI.');
assert.match(app, /App Version/, 'Settings must expose the running release to the user.');
assert.match(app, /does not erase browser-stored finance data/, 'Settings must make the non-destructive update behavior explicit.');
console.log('Penny foreground update verification tests passed');
