import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/mobile-nav-content-v70.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const version = await readFile(new URL('../public/version.json', import.meta.url), 'utf8');
const v69 = await readFile(new URL('../src/mobile-nav-pixel-v69.css', import.meta.url), 'utf8');

assert.match(main, /import '\.\/mobile-nav-pixel-v69\.css';\s*\nimport '\.\/mobile-nav-content-v70\.css';/, 'v70 must load after the v69 pixel-matched bar geometry.');
assert.match(v69, /height:\s*calc\(45px/, 'v69 must continue to own the 45px bar height.');
assert.match(css, /\.nav button::before\s*\{[\s\S]*width:\s*26px;[\s\S]*height:\s*26px;/, 'Navigation icons must use the larger 26px reference-matched size.');
assert.match(css, /\.nav button::after\s*\{[\s\S]*font-size:\s*12px;[\s\S]*line-height:\s*1;/, 'Navigation labels must use the larger 12px reference-matched size.');
assert.match(css, /\.nav button\s*\{[\s\S]*gap:\s*0;[\s\S]*padding:\s*0 1px;/, 'The enlarged icon and label group must fit inside the unchanged 44px tap target.');
assert.doesNotMatch(css, /height:\s*45px|min-height:\s*45px|max-height:\s*45px|padding-bottom:/, 'v70 must not alter the established v69 bar height or bottom geometry.');
assert.match(version, /2026-08-31-nav-content-match-v70/, 'The release marker must identify v70.');

console.log('Penny v70 navigation content match regression tests passed');
