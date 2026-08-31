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

const uninstall = installMonthPickerActivation(root);
assert.equal(typeof clickHandler, 'function', 'month picker activation should install a click handler');

let opened = 0;
const input = {
  disabled: false,
  showPicker() { opened += 1; },
};
const target = {
  closest(selector) {
    return selector === '.month-input' ? input : null;
  },
};

clickHandler({ target });
assert.equal(opened, 1, 'clicking the month input should explicitly open the native picker when supported');

input.disabled = true;
clickHandler({ target });
assert.equal(opened, 1, 'disabled month inputs must not open the picker');

uninstall();
assert.equal(removedHandler, clickHandler, 'cleanup should remove the installed click handler');

console.log('month picker activation regression test passed');
