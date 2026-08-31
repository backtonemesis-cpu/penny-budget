import { readFile } from 'node:fs/promises';

const css = await readFile('src/assignment-row-compact-v89.css', 'utf8');
const main = await readFile('src/main.jsx', 'utf8');

function requireText(text, token, label) {
  if (!text.includes(token)) throw new Error('v89 missing ' + label);
}

requireText(main, "import './assignment-row-compact-v89.css';", 'v89 stylesheet import');
requireText(css, 'section[aria-labelledby="income-list-title"] .assignment-line', 'income assignment row scope');
requireText(css, 'section[aria-labelledby="expenses-list-title"] .assignment-line', 'expense assignment row scope');
requireText(css, 'flex-wrap: nowrap;', 'single-line assignment layout');
requireText(css, 'width: min(calc(100vw - 50px), calc(100% + 118px));', 'mobile full-row assignment width');
requireText(css, '.assignment-line > .assignment-select:first-of-type', 'person control sizing');
requireText(css, '.assignment-line > .assignment-select:last-of-type', 'account control sizing');
requireText(css, 'flex: 1 1 128px;', 'account control flexible width');

console.log('v89 assignment row layout regression passed');
