import { readFile } from 'node:fs/promises';
import { transformMonthSelectorV74 } from '../build/month-selector-v74.js';
import { transformDesktopMonthPickerV75 } from '../build/desktop-month-picker-v75.js';

const source = `import { useEffect, useMemo, useReducer, useRef, useState } from 'react';\nconst SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];\nfunction App() {\n  return (\n    <div>\n          <div className="month-control">\n            <input\n              className="month-input"\n              aria-label="Selected month and year"\n              type="month"\n              value={monthKey}\n              min="1900-01"\n              onChange={(event) => setMonthValue(event.target.value, { followCurrent: false })}\n            />\n          </div>\n    </div>\n  );\n}\n`;

const v74 = transformMonthSelectorV74(source);
const transformed = transformDesktopMonthPickerV75(v74);

for (const required of [
  'function PennyDesktopMonthSelector',
  'className="desktop-month-trigger"',
  'className="desktop-month-popover"',
  'className="desktop-month-grid"',
  'Previous year',
  'Next year',
  'This month',
  'className="month-input penny-month-native"',
  'onSelectMonth={(value) => setMonthValue(value, { followCurrent: false })}',
]) {
  if (!transformed.includes(required)) throw new Error(`v75 missing expected output: ${required}`);
}

if (transformed.includes('          <div className="month-control">\n            <span className="month-display"')) {
  throw new Error('v75 left the old v74 header selector in place.');
}

const css = await readFile('src/desktop-month-picker-v75.css', 'utf8');
if (!css.includes('@media (min-width: 761px)')) throw new Error('v75 desktop picker is not desktop-only.');
if (!css.includes('.penny-month-selector .penny-month-native')) throw new Error('v75 does not hide the native picker on desktop.');
if (!css.includes('grid-template-columns: repeat(4')) throw new Error('v75 month grid is not four columns.');
if (!css.includes('.desktop-month-grid button.selected')) throw new Error('v75 has no selected-month styling.');

const mobileCss = await readFile('src/mobile-month-label-v74.css', 'utf8');
if (!mobileCss.includes('@media (max-width: 760px)')) throw new Error('v75 must preserve the native mobile month picker path.');

console.log('v75 desktop month picker regression passed');
