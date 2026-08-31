import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/mobile-nav-pixel-v69.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

assert.match(main, /import '\.\/mobile-nav-native-v68\.css';\s*\nimport '\.\/mobile-nav-pixel-v69\.css';/, 'v69 must load after v68 so the measured geometry remains authoritative.');
assert.match(css, /\.app\s*\{[\s\S]*padding-bottom:\s*calc\(45px \+ max\(0px, calc\(env\(safe-area-inset-bottom\) - 34px\)\)\)/, 'Scrollable content must reserve the 45px reference footprint on a standard iPhone.');
assert.match(css, /\.nav\s*\{[\s\S]*height:\s*calc\(45px \+ max\(0px, calc\(env\(safe-area-inset-bottom\) - 34px\)\)\)[\s\S]*padding-top:\s*0;[\s\S]*padding-bottom:\s*max\(0px, calc\(env\(safe-area-inset-bottom\) - 34px\)\)/, 'The real nav box must remain 45px on the reference iPhone, not merely visually translated.');
assert.match(css, /\.nav button\s*\{[\s\S]*height:\s*44px;[\s\S]*min-height:\s*44px;[\s\S]*max-height:\s*44px;[\s\S]*transform:\s*none;/, 'Tabs must retain the iOS 44px touch target while the container stays shortened around them.');

console.log('Penny v69 pixel-matched bottom navigation regression tests passed');
