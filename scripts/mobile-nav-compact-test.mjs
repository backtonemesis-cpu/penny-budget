import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/mobile-nav-compact-v65.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

assert.match(main, /import '\.\/mobile-nav-compact-v65\.css';/, 'The compact navigation override must load after the base mobile navigation styles.');
assert.match(css, /padding-bottom:\s*calc\(58px \+ env\(safe-area-inset-bottom\)\)/, 'Scrollable content must reserve the compact navigation plus iPhone safe area.');
assert.match(css, /\.nav\s*\{[\s\S]*padding:\s*2px[^;]*env\(safe-area-inset-bottom\)/, 'The navigation bar must preserve the bottom safe-area inset with compact vertical padding.');
assert.match(css, /\.nav button\s*\{[\s\S]*min-height:\s*48px/, 'Each primary tab must keep a 48px touch target.');
assert.match(css, /\.nav button::before\s*\{[\s\S]*width:\s*20px;[\s\S]*height:\s*20px;/, 'Primary navigation icons must use the compact 20px size.');
assert.match(css, /\.nav button\.active\s*\{[\s\S]*rgba\(96, 165, 250, 0\.11\)/, 'The active tab treatment must remain visible without the previous oversized visual weight.');

console.log('Penny compact mobile navigation regression tests passed');
