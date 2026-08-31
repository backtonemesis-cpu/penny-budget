import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/mobile-nav-native-v68.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const version = await readFile(new URL('../public/version.json', import.meta.url), 'utf8');

assert.match(main, /import '\.\/mobile-nav-content-v67\.css';\s*\nimport '\.\/mobile-nav-native-v68\.css';/, 'v68 must load after the earlier navigation overrides.');
assert.match(css, /\.app\s*\{[\s\S]*padding-bottom:\s*calc\(54px \+ max\(0px, calc\(env\(safe-area-inset-bottom\) - 34px\)\)\)/, 'Scrollable content must reserve the new compact native-style navigation footprint.');
assert.match(css, /\.nav\s*\{[\s\S]*padding-top:\s*1px;[\s\S]*padding-bottom:\s*max\(8px, calc\(env\(safe-area-inset-bottom\) - 26px\)\)/, 'The navigation must use the reduced iPhone bottom allowance.');
assert.match(css, /\.nav button\s*\{[\s\S]*min-height:\s*44px;[\s\S]*transform:\s*none;/, 'Primary tabs must use the iOS 44px minimum touch target and remove the v67 visual translation.');
assert.match(css, /gap:\s*1px;[\s\S]*padding:\s*2px 1px 1px;/, 'Icon and label spacing must stay compact inside the shorter bar.');
assert.match(version, /2026-08-31-native-bottom-nav-v68/, 'The release marker must identify v68.');

console.log('Penny v68 native-height bottom navigation regression tests passed');
