import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/settings-fix.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

assert.match(main, /import '\.\/settings-fix\.css';/, 'Settings repair stylesheet must load after the main mobile stylesheet.');
assert.match(css, /width: calc\(100vw - 20px\) !important;/, 'Settings sheet must be constrained to the iPhone viewport.');
assert.match(css, /@supports \(width: 100dvw\)/, 'Settings sheet must use the dynamic viewport when supported.');
assert.match(css, /-webkit-text-size-adjust: 100%;/, 'iOS text inflation must not be allowed to break the Settings layout.');
assert.match(css, /settings-section:has\(> h3 \+ \.section-note > strong\) \{\s*display: none !important;/s, 'The App Version card must not take visible Settings space.');
assert.match(css, /\.settings-row > \.danger-button:disabled \{\s*display: none !important;/s, 'Repeated In use buttons must be removed from the visible Settings layout while code-level protection remains.');
assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(84px, 108px\);/, 'Normal account rows must fit account name and owner inside one line.');
assert.match(css, /account-settings-row:has\(> \.danger-button:not\(:disabled\)\)/, 'A real Remove action must still get its own account-row column when available.');
assert.match(css, /\.account-settings-row > input,[\s\S]*\.account-settings-row > select,[\s\S]*\.account-settings-row > \.primary-button,[\s\S]*\.account-settings-row > \.danger-button:not\(:disabled\) \{\s*height: 52px;\s*min-height: 52px;/s, 'Account name, owner selector and action button must use exactly the same mobile row height.');
assert.match(css, /\.icon-picker,[\s\S]*\.icon-grid,[\s\S]*\.category-list,[\s\S]*\.category-list-body,[\s\S]*\.category-settings-row \{\s*width: 100%;\s*min-width: 0;\s*max-width: 100%;/s, 'Every category control must be width-constrained inside the Settings card.');
assert.match(css, /\.icon-grid \{\s*display: grid;\s*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);[\s\S]*overflow-x: hidden;/s, 'Category icons must wrap into an in-card grid instead of extending beyond the right edge.');
assert.match(css, /@media \(max-width: 390px\)[\s\S]*\.icon-grid \{\s*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/s, 'Narrow iPhones must use a five-column icon grid so all category icons remain contained.');
assert.match(css, /\.stacked-actions > \* \{[^}]*min-width: 0;[^}]*min-height: 42px;/s, 'Backup controls must stay compact and responsive.');

console.log('Penny Settings viewport regression passed: uniform account controls and contained category icons are protected on iPhone.');
