import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformMonthSelectorV74 } from '../build/month-selector-v74.js';

const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const transformed = transformMonthSelectorV74(source);
const css = await readFile(new URL('../src/mobile-month-label-v74.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const vite = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
const version = await readFile(new URL('../public/version.json', import.meta.url), 'utf8');

assert.match(transformed, /className="month-display" aria-hidden="true">\{SHORT_MONTHS\[period\.month\]\} \{period\.year\}<\/span>/, 'Mobile header must render an abbreviated month plus explicit four-digit year.');
assert.match(transformed, /className="month-input"[\s\S]*type="month"[\s\S]*value=\{monthKey\}/, 'The native month input and its controlled monthKey value must remain intact.');
assert.match(css, /\.month-display[\s\S]*font-size:\s*15px;[\s\S]*white-space:\s*nowrap;/, 'The visible short month label must remain centred on one line.');
assert.match(css, /\.month-input[\s\S]*position:\s*absolute;[\s\S]*opacity:\s*0;/, 'The native month input must remain the invisible interactive tap target on mobile.');
assert.match(main, /import '\.\/mobile-month-label-v74\.css';/, 'v74 mobile month label styles must be loaded after the prior header fixes.');
assert.match(vite, /monthSelectorV74Plugin\(\)/, 'The v74 React-source transform must run in the Vite pipeline.');
assert.match(version, /2026-08-31-short-month-label-v74/, 'The release marker must identify v74.');

console.log('Penny v74 abbreviated month label regression tests passed');
