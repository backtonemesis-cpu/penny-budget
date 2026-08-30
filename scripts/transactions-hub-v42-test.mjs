import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.jsx', 'utf8');

assert.match(app, /PENNY_V42_TRANSACTIONS_HUB/, 'Transactions hub state must be installed');
assert.match(app, /setTransactionTab\('income'\); setView\('Transactions'\)/, 'Overview Income must open Transactions > Income');
assert.match(app, /setTransactionTab\('expenses'\); setView\('Transactions'\)/, 'Overview Expenses must open Transactions > Expenses');
assert.match(app, /setTransactionTab\('savings'\); setView\('Transactions'\)/, 'Overview Savings must open Transactions > Savings');
assert.match(app, />Income<\/button>[\s\S]*>Expenses<\/button>[\s\S]*>Savings<\/button>/, 'primary Transactions tabs must follow Income, Expenses, Savings order');
assert.match(app, /tab === 'savings'[\s\S]*<Savings/, 'Savings must render inside Transactions');
assert.match(app, /Transfers & excluded movements/, 'transfers must remain available as secondary audit evidence');
assert.doesNotMatch(app, /\['Overview', 'Transactions', 'Savings', 'Year'\]/, 'Savings must not remain a separate primary navigation tab');
assert.match(app, /\['Overview', 'Transactions', 'Year'\]/, 'primary navigation must be Overview, Transactions, Year');
assert.match(app, /tab !== 'savings' &&/, 'transaction search/filter controls must not clutter the Savings tab');

console.log('Penny v42 unified Transactions hub regression passed.');
