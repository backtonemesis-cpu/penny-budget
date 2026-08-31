import assert from 'node:assert/strict';
import { installMonthPickerActivation } from '../src/month-picker-activation.js';

let clickHandler;
let removedHandler;
const root = {
  addEventListener(type, handler) {
    if (type === 'click') clickHandler = handler;
  },
  removeEventListener(type, handler) {
    if (type === 'click') removedHandler = handler;
  },
};

const originalMatchMedia = globalThis.matchMedia;
const uninstall = installMonthPickerActivation(root);
assert.equal(typeof clickHandler, 'function', 'month picker activation should install a click handler');

let opened = 0;
let lastMediaQuery = '';
const input = {
  disabled: false,
  showPicker() { opened += 1; },
};
const target = {
  closest(selector) {
    return selector === '.month-input' ? input : null;
  },
};

globalThis.matchMedia = (query) => {
  lastMediaQuery = query;
  return { matches: false };
};
clickHandler({ target });
assert.equal(opened, 1, 'touch/mobile month input should explicitly open the native picker when supported');
assert.match(lastMediaQuery, /pointer: fine/, 'desktop ownership must consider fine-pointer laptops rather than width alone');

globalThis.matchMedia = (query) => {
  lastMediaQuery = query;
  return { matches: true };
};
clickHandler({ target });
assert.equal(opened, 1, 'desktop/fine-pointer devices must not invoke the native picker because Penny owns desktop selection');
assert.match(lastMediaQuery, /min-width: 761px/, 'existing wide desktop ownership must remain supported');

globalThis.matchMedia = () => ({ matches: false });
input.disabled = true;
clickHandler({ target });
assert.equal(opened, 1, 'disabled month inputs must not open the picker');

uninstall();
assert.equal(removedHandler, clickHandler, 'cleanup should remove the installed click handler');

if (originalMatchMedia) globalThis.matchMedia = originalMatchMedia;
else delete globalThis.matchMedia;

console.log('month picker activation regression test passed');
