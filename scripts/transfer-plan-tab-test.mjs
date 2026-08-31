import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformPrimaryNavForTransferPlan } from '../build/primary-nav-v64.js';
import { transformTransferPlanTab } from '../build/transfer-plan-tab.js';

const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const normalizedSource = transformPrimaryNavForTransferPlan(source);
const transformed = transformTransferPlanTab(normalizedSource);
const css = await readFile(new URL('../src/transfer-plan-tab.css', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

const overviewStart = transformed.indexOf('function Overview(');
const transferPlanStart = transformed.indexOf('function TransferPlan(');
const fundingEditorStart = transformed.indexOf('function FundingBalanceEditor(');
assert.ok(overviewStart >= 0 && transferPlanStart > overviewStart && fundingEditorStart > transferPlanStart, 'Overview, TransferPlan and FundingBalanceEditor must remain in a safe order.');

const overview = transformed.slice(overviewStart, transferPlanStart);
const transferPlan = transformed.slice(transferPlanStart, fundingEditorStart);

assert.equal((transformed.match(/Start-of-Month Transfer Plan/g) || []).length, 1, 'The full Start-of-Month Transfer Plan must exist exactly once after the move.');
assert.doesNotMatch(overview, /Start-of-Month Transfer Plan/, 'Overview must no longer contain the full transfer-plan workflow.');
assert.match(overview, /transfer-plan-overview-card/, 'Overview must keep a compact Transfer Plan summary card.');
assert.match(overview, /onOpenTransferPlan/, 'The Overview summary must use a React navigation action.');
assert.match(transferPlan, /summary\.accountFundingPlan\.length \? summary\.accountFundingPlan\.map/, 'The dedicated Transfer Plan must preserve the existing per-account funding plan.');
assert.match(transferPlan, /onCommit=\{\(value\) => onUpdateBankBalance\(row\.account, value\)\}/, 'The existing bank-balance update action must remain unchanged.');
assert.match(transformed, /view === 'Transfer Plan'/, 'App must render a dedicated Transfer Plan view.');
assert.match(transformed, /onOpenTransferPlan=\{\(\) => setView\('Transfer Plan'\)\}/, 'Overview must navigate into the dedicated Transfer Plan view.');
assert.match(transformed, /\['Overview', 'Transactions', 'Savings', 'Transfer Plan'\]\.map/, 'Primary navigation must expose Overview, Transactions, Savings and Transfer Plan internally.');
assert.doesNotMatch(transformed, /\['Overview', 'Transactions', 'Year'\]\.map/, 'The postinstall three-item navigation must not survive into production.');
assert.doesNotMatch(transformed, /\['Overview', 'Transactions', 'Savings', 'Year'\]\.map/, 'Year must no longer occupy the fourth primary navigation slot.');

assert.match(mainSource, /import '\.\/transfer-plan-tab\.css';/, 'The Transfer Plan navigation and summary styles must be loaded.');
assert.match(css, /\.nav button:nth-child\(4\) \{[^}]*display: flex !important;/s, 'The fourth navigation slot must be explicitly visible.');
assert.match(css, /\.nav button:nth-child\(4\)::after \{[^}]*content: "Transfers" !important;/s, 'The fourth visible navigation label must be Transfers.');
assert.doesNotMatch(css, /\.nav button:nth-child\(4\)::after \{[^}]*font-size:/s, 'Transfers must inherit the same navigation label size as the other primary tabs.');
assert.match(css, /transfer-plan-overview-card/, 'The compact Overview summary must have dedicated presentation rules.');

console.log('Penny dedicated Transfer Plan tab regression tests passed');
