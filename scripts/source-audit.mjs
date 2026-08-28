import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const files = {
  app: await read('../src/App.jsx'),
  catalog: await read('../src/catalog.js'),
  currentPeriod: await read('../src/current-period.js'),
  finance: await read('../src/finance.js'),
  main: await read('../src/main.jsx'),
  state: await read('../src/state.js'),
  storage: await read('../src/storage.js'),
  selfTest: await read('./self-test.mjs'),
  workflow: await read('../.github/workflows/deploy.yml'),
  index: await read('../index.html'),
};

const publicSource = [files.app, files.catalog, files.currentPeriod, files.finance, files.main, files.state, files.storage].join('\n');
const auditedCode = [publicSource, files.selfTest, files.workflow].join('\n');
const group = process.argv[2] || 'all';
const blockedIdentityHashes = new Set([
  '5b39bfccb1447d4aae30e7a4fb0f4ba37e79ea96ec54b5ba7223979a15e4d0ae',
  '79f950e57d58f374c9ad4f40680ec2d2560644de2acfe9ccd282f61974759028',
  'ea8c2cb25c23881f00554c14ed300c687dbf6a18826e548e9a82c19c36373f31',
]);

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function accessibilityAudit() {
  assert.doesNotMatch(files.index, /user-scalable\s*=\s*no/i, 'Pinch zoom must remain available.');
  assert.doesNotMatch(files.index, /maximum-scale\s*=\s*1/i, 'Page zoom must not be artificially capped.');
  assert.match(files.app, /label="Paid By"/);
  assert.match(files.app, /label="Received By"/);
}

function storageAudit() {
  assert.doesNotMatch(files.main, /indexedDB\.deleteDatabase|caches\.delete/, 'Startup must not purge browser-wide storage.');
  assert.doesNotMatch(files.main, /location\.reload/, 'Release checks should use a versioned replace, not reload loops.');
  assert.match(files.storage, /KNOWN_STATE_FIELDS/);
  assert.match(files.storage, /formatVersion:\s*CURRENT_STATE_VERSION/);
  assert.match(files.storage, /mergeImportedMonths/);
  assert.match(files.storage, /importMode === 'merge_months'/);
  assert.match(files.storage, /monthMetaByMonth/);
  assert.match(files.finance, /savingsByMonth/);
  assert.match(files.finance, /monthMetaByMonth/);
  assert.match(files.app, /month-specific savings snapshot/i);
}

function identityAudit() {
  const tokens = auditedCode.toLowerCase().match(/[a-z0-9]+/g) || [];
  for (let width = 1; width <= 4; width += 1) {
    for (let index = 0; index <= tokens.length - width; index += 1) {
      const candidate = tokens.slice(index, index + width).join(' ');
      assert.equal(blockedIdentityHashes.has(digest(candidate)), false, 'Public code contains blocked private identity data.');
    }
  }
}

function currencyAudit() {
  assert.doesNotMatch(publicSource, /£\s?\d/, 'Public app source must not embed real household currency figures.');
}

function financeAudit() {
  assert.match(files.finance, /expectedClosingSavings\s*=\s*isComplete \? startingSavings \+ income - expenses/, 'Completed months must reconcile starting savings plus income less actual expenses.');
  assert.match(files.finance, /projectedEndSavings\s*=\s*isComplete[\s\S]*currentSavings - remainingBills[\s\S]*currentSavings \+ savedThisMonth/, 'Live projected end must add only net monthly saving to current savings.');
  assert.match(files.finance, /projectedIncrease\s*=\s*savedThisMonth/, 'Projected increase must equal Saved This Month.');
  assert.doesNotMatch(files.finance, /currentSavings \+ income - remainingBills/, 'The superseded gross-income projection formula must not return.');
  assert.match(files.app, /Plus: Saved This Month/);
  assert.match(files.app, /Savings \+ saved this month/);
  assert.match(files.finance, /currentSavingsTotal\(state, monthKey\)/, 'Savings must be resolved from the selected month.');
  assert.match(files.finance, /paidBy/);
  assert.match(files.finance, /receivedBy/);
  assert.match(files.finance, /transferPlan/);
  assert.match(files.finance, /freeSavingsAfterBills\s*=\s*currentSavings - remainingBills/);
  assert.doesNotMatch(files.catalog, /id:\s*['"]refund['"]/, 'Refund entry must not return to the public transaction choices.');
  assert.match(files.catalog, /id:\s*'household',\s*label:\s*'Joint'/, 'The shared payer label must match the current Family Tracker terminology.');
  assert.match(files.app, /Historical Reconciliation/);
  assert.match(files.app, /Expected Closing Savings/);
  assert.match(files.app, /Reconciliation Variance/);
  assert.match(files.app, /Transfer Plan/);
  assert.match(files.app, /Payment status/);
}

const audits = {
  accessibility: accessibilityAudit,
  storage: storageAudit,
  identity: identityAudit,
  currency: currencyAudit,
  finance: financeAudit,
};
if (group === 'all') Object.values(audits).forEach((audit) => audit());
else if (audits[group]) audits[group]();
else throw new Error(`Unknown source-audit group: ${group}`);

console.log(`Penny ${group} source audit passed`);
