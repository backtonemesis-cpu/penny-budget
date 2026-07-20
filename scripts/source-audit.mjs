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
  assert.doesNotMatch(files.app, /max=["']2035-12["']/, 'The month picker must not stop at 2035.');
}

function storageAudit() {
  assert.doesNotMatch(files.main, /removeMatchingStorage|indexedDB\.deleteDatabase|caches\.delete/, 'Startup must not purge browser-wide storage.');
  assert.doesNotMatch(files.main, /window\.location\.reload|location\.reload/, 'Period updates must not force page reloads.');
  assert.match(files.storage, /KNOWN_STATE_FIELDS/);
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
  assert.doesNotMatch(publicSource, /£\s?\d/, 'Public app source must not embed real currency figures.');
}

function financeAudit() {
  assert.match(files.finance, /available:\s*income \+ refunds - fixedBills - grossSpending/, 'Available-money formula must remain explicit.');
  assert.match(files.catalog, /internal_transfer/);
  assert.match(files.catalog, /savings_transfer/);
  assert.match(files.catalog, /card_repayment/);
  assert.doesNotMatch(files.app, /onManageCategories|Treat this as a fixed monthly bill/, 'Category management must not live in Activity or use the old checkbox wording.');
  assert.match(files.app, /Everyday spending/);
  assert.match(files.app, /Fixed monthly bill/);
  assert.match(files.app, /icon-choice/);
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
