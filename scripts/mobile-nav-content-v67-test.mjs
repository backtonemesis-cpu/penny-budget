import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/mobile-nav-content-v67.css', import.meta.url), 'utf8');
const compactCss = await readFile(new URL('../src/mobile-nav-compact-v65.css', import.meta.url), 'utf8');
const lowerCss = await readFile(new URL('../src/mobile-nav-lower-v66.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

assert.match(main, /import '\.\/mobile-nav-lower-v66\.css';\s*\nimport '\.\/mobile-nav-content-v67\.css';/, 'v67 positioning must load after the v66 safe-area override.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.nav button\s*\{[\s\S]*transform:\s*translateY\(8px\)/, 'Mobile navigation icon/label groups must move 8px lower inside the existing bar.');
assert.match(compactCss, /\.nav button\s*\{[\s\S]*min-height:\s*48px/, 'The 48px primary-tab touch target must remain unchanged.');
assert.match(lowerCss, /safe-area-inset-bottom/, 'The guarded iPhone bottom safe-area treatment must remain in place.');
assert.doesNotMatch(css, /padding-bottom|height|min-height/, 'v67 must not shrink the navigation bar or touch targets; it only repositions the content.');

console.log('Penny lower navigation content regression tests passed');
