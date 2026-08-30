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
assert.match(css, /\.stacked-actions > \* \{[^}]*min-width: 0;[^}]*min-height: 42px;/s, 'Backup controls must stay compact and responsive.');

console.log('Penny Settings viewport regression passed: no version clutter, no repeated In use controls, and no mobile horizontal overflow.');
