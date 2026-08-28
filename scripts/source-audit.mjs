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
  mobileNav: await read('../src/mobile-navigation.css'),
  state: await read('../src/state.js'),
  storage: await read('../src/storage.js'),
  styles: await read('../src/styles.css'),
  selfTest: await read('./self-test.mjs'),
  finalTest: await read('./final-audit-test.mjs'),
  workflow: await read('../.github/workflows/deploy.yml'),
  index: await read('../index.html'),
  lockfile: await read('../package-lock.json'),
  packageJson: await read('../package.json'),
};

const publicSource = [files.app, files.catalog, files.currentPeriod, files.finance, files.main, files.mobileNav, files.state, files.storage, files.styles].join('\n');
const auditedCode = [publicSource, files.selfTest, files.finalTest, files.workflow].join('\n');
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
  assert.match(files.index, /Content-Security-Policy/, 'A restrictive browser Content Security Policy must remain present.');
  assert.match(files.index, /object-src 'none'/, 'CSP must block plugin/object content.');
  assert.doesNotMatch(files.index, /'unsafe-inline'|'unsafe-eval'/, 'CSP must not allow unsafe inline/eval execution.');
  assert.doesNotMatch(files.index, /wss?:\/\//, 'CSP must not open unneeded websocket origins.');
  assert.match(files.index, /referrer.*no-referrer/, 'Financial app must not leak navigation referrers.');
  assert.match(files.app, /label="Paid By"/);
  assert.match(files.app, /label="Received By"/);
  assert.match(files.app, /querySelectorAll\('button:not\(\[disabled\]\)/, 'Modal must contain a keyboard focus trap.');
  assert.match(files.app, /previouslyFocused/, 'Modal must remember the opener for focus restoration.');
  assert.match(files.app, /document\.contains\(previouslyFocused\).*previouslyFocused\.focus\(\)/s, 'Modal must restore focus to the opener when possible.');
  assert.match(files.styles, /min-height:\s*44px/, 'Primary form controls must retain accessible touch targets.');
  assert.match(files.mobileNav, /font-size:\s*10\.5px/, 'Mobile navigation labels must remain legible.');
  assert.doesNotMatch(files.mobileNav, /font-size:\s*[0-8](?:\.\d+)?px/, 'Mobile navigation labels must not regress below 9px.');
}

function storageAudit() {
  assert.doesNotMatch(files.main, /indexedDB\.deleteDatabase|caches\.delete/, 'Startup must not purge browser-wide storage.');
  assert.doesNotMatch(files.main, /location\.reload/, 'Release checks should use a versioned replace, not reload loops.');
  assert.match(files.storage, /ROLLBACK_STORAGE_KEY/);
  assert.match(files.storage, /saveRollbackState/);
  assert.match(files.storage, /loadRollbackState/);
  assert.match(files.storage, /recoveryRequired:\s*true/, 'Unreadable saved state must enter protected recovery mode.');
  assert.match(files.storage, /hasFutureStateVersion/, 'Newer local state must be detected before migration.');
  assert.match(files.storage, /formatVersion.*> CURRENT_STATE_VERSION/s, 'Future-format backup wrappers must be rejected.');
  assert.match(files.storage, /hasFutureStateVersion\(candidate\)/, 'Future raw state inside backups must also be rejected.');
  assert.match(files.storage, /mergeImportedMonths/);
  assert.match(files.storage, /auditLog/);
  assert.match(files.finance, /savingsByMonth/);
  assert.match(files.finance, /monthMetaByMonth/);
  assert.match(files.app, /disabled=\{recoveryRequired\}/, 'Normal backup export must be disabled while storage recovery is required.');
  assert.match(files.app, /blank in-memory fallback is deliberately not exportable/i, 'Recovery UI must explain why ordinary backup export is unavailable.');
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
  assert.match(files.finance, /roundMoney/);
  assert.match(files.finance, /sumMoney/);
  assert.match(files.finance, /typeof rawInput === 'number'/, 'Completed-month starting savings must distinguish missing values from explicit numeric zero.');
  assert.match(files.finance, /typeof rawInput === 'string' && rawInput\.trim\(\) !== ''/, 'Blank starting-savings strings must remain missing evidence.');
  assert.match(files.finance, /startingSavingsConfirmed\s*=\s*Boolean\(isComplete && monthMeta\.startingSavingsConfirmed\)/, 'Completed reconciliation must depend on confirmed starting savings.');
  assert.match(files.finance, /expectedClosingSavings\s*=\s*startingSavingsConfirmed \? roundMoney\(startingSavings \+ income - expenses\) : null/, 'Expected closing savings must remain TBC when starting savings evidence is missing.');
  assert.match(files.finance, /projectedEndSavings\s*=\s*isComplete \? currentSavings : roundMoney\(currentSavings \+ savedThisMonth\)/, 'Completed months must stop at recorded closing savings; live months may project snapshot plus net saving.');
  assert.match(files.finance, /projectedIncrease\s*=\s*isComplete \? 0 : savedThisMonth/, 'Completed months must not have a forward projected increase.');
  assert.doesNotMatch(files.finance, /currentSavings \+ income - remainingBills/, 'The superseded gross-income projection formula must not return.');
  assert.match(files.finance, /auditReady\s*=\s*Boolean\(isComplete && startingSavingsConfirmed && incompleteRecords === 0 && !reconciliationProblem && hasSavingsSnapshot\)/, 'Only completed, explicitly grounded, reconciled and fully confirmed months may be audit-ready.');
  assert.match(files.finance, /evidenceStatus/);
  assert.match(files.finance, /monthsInProgress/);
  assert.match(files.finance, /!withData\.length \? 'empty'/, 'An empty year must be represented as empty rather than review-ready evidence.');
  assert.match(files.finance, /confirmationIssues/);
  assert.match(files.finance, /dateConfirmed/);
  assert.match(files.finance, /paid:\s*type === 'expense'.*false/s, 'Expense payment status must default conservatively to unpaid.');
  assert.match(files.finance, /isLikelyDuplicateTransaction/);
  assert.match(files.finance, /isLikelyDuplicateIncome/);
  assert.match(files.finance, /paidByLabel/);
  assert.match(files.finance, /receivedByLabel/);
  assert.match(files.state, /balance:\s*positiveNumber\(item\?\.balance\)/, 'Savings snapshots must be normalised to pennies before storage and audit logging.');
  assert.match(files.state, /auditLog/);
  assert.match(files.state, /before:\s*event\.before \?\? null/, 'Change History must store the event before-state.');
  assert.match(files.state, /action:\s*'delete'.*before \}\);/s, 'Delete actions must pass the deleted record into Change History.');
  assert.match(files.app, /Date TBC/);
  assert.match(files.app, /Starting savings needs confirmation/);
  assert.match(files.app, /<EvidenceTbcRow label="Starting Savings"/);
  assert.match(files.app, /Completed month — locked/);
  assert.match(files.app, /Change History/);
  assert.match(files.app, /Save this second record anyway\?/);
  assert.match(files.app, /createRollbackAfterApproval/);
  assert.match(files.app, /<AuditSnapshot title="Before"/);
  assert.match(files.app, /In progress — this month is planning data, not final mortgage evidence/);
  assert.match(files.app, /evidenceStatusLabel/);
  assert.match(files.app, /Only completed, reconciled months can be mortgage-ready/);
  assert.match(files.app, /!summary\.isComplete && \(/, 'Current savings-goal planning must be hidden from completed historical months.');
  assert.match(files.app, /followCurrentPeriodRef\.current/, 'Historical month selection must not be overwritten by automatic current-period refresh.');
  assert.match(files.styles, /white-space:\s*nowrap/, 'Currency values must not wrap mid-number.');
  assert.doesNotMatch(files.catalog, /id:\s*['"]refund['"]/, 'Refund entry must not return to the public transaction choices.');
  assert.match(files.catalog, /id:\s*'household',\s*label:\s*'Joint'/, 'The shared payer label must match the current Family Tracker terminology.');
  assert.match(files.packageJson, /"postcss":\s*"8\.5\.23"/, 'The patched PostCSS build dependency must remain pinned.');
  assert.match(files.lockfile, /"node_modules\/postcss"[\s\S]*?"version":\s*"8\.5\.23"/, 'The lockfile must resolve the patched PostCSS release.');
  assert.match(files.workflow, /actions\/checkout@v5/);
  assert.match(files.workflow, /actions\/setup-node@v5/);
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
