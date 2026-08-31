import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const compactCss = await readFile(new URL('../src/mobile-nav-compact-v65.css', import.meta.url), 'utf8');
const lowerCss = await readFile(new URL('../src/mobile-nav-lower-v66.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

const compactImport = main.indexOf("import './mobile-nav-compact-v65.css';");
const lowerImport = main.indexOf("import './mobile-nav-lower-v66.css';");
assert.ok(compactImport >= 0 && lowerImport > compactImport, 'The v66 safe-area override must load after the v65 compact navigation styles.');
assert.match(compactCss, /\.nav button\s*\{[\s\S]*min-height:\s*48px/, 'The existing 48px tab touch targets must remain protected.');
assert.match(lowerCss, /padding-bottom:\s*calc\(58px \+ max\(0px, calc\(env\(safe-area-inset-bottom\) - 14px\)\)\)/, 'Scrollable content must reserve the reduced iPhone safe-area allowance.');
assert.match(lowerCss, /\.nav\s*\{[\s\S]*padding-bottom:\s*calc\(2px \+ max\(0px, calc\(env\(safe-area-inset-bottom\) - 14px\)\)\)/, 'The bottom navigation must remove 14px of dead space while retaining guarded home-indicator clearance.');
assert.doesNotMatch(lowerCss, /\.nav button\s*\{/, 'v66 must not shrink the tab touch targets or alter tab content sizing.');

console.log('Penny v66 lower bottom navigation regression tests passed');
