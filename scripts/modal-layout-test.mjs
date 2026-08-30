import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const mobileCss = await readFile(new URL('../src/mobile-navigation.css', import.meta.url), 'utf8');

assert.match(css, /\.modal \{[^}]*overflow: hidden;[^}]*overscroll-behavior: contain;/s, 'Modal backdrop must not become a second scroll container.');
assert.match(css, /\.modal-inner \{[^}]*max-height: calc\(100dvh - max\(14px, env\(safe-area-inset-top\)\) - max\(14px, env\(safe-area-inset-bottom\)\)\);[^}]*overflow-y: auto;[^}]*-webkit-overflow-scrolling: touch;/s, 'Modal content must use one safe-area-aware iOS vertical scroll container.');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.modal-inner > \.actions \{[^}]*position: sticky;[^}]*bottom: -16px;/, 'Mobile editor actions must remain reachable while the form scrolls.');
assert.doesNotMatch(css, /\.modal \{[^}]*overflow-y: auto;/s, 'Modal backdrop must never regain independent vertical scrolling.');
assert.match(mobileCss, /\.modal \{[^}]*overflow-x: clip;[^}]*overscroll-behavior-x: none;[^}]*touch-action: pan-y pinch-zoom;/s, 'Modal backdrop must reject horizontal panning on mobile.');
assert.match(mobileCss, /\.modal-inner \{[^}]*max-width: 100%;[^}]*overflow-x: hidden;[^}]*overscroll-behavior-x: none;[^}]*touch-action: pan-y pinch-zoom;/s, 'The iPhone editor scroll container must be locked to vertical scrolling only.');

console.log('Penny mobile modal layout regression tests passed');
