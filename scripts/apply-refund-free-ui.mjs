import { readFile, writeFile, rm } from 'node:fs/promises';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Could not find ${label}`);
  return source.replace(before, after);
}

let app = await readFile('src/App.jsx', 'utf8');
app = replaceRequired(
  app,
  "const needsCategory = payload.type === 'expense' || payload.type === 'refund';",
  "const needsCategory = payload.type === 'expense';",
  'transaction category rule',
);
app = replaceRequired(
  app,
  '        <Stat label="Refunds / credits" value={formatMoney(summary.refunds)} tone="green" sub="Money returned" onClick={onTransactions} />\n',
  '',
  'overview refunds card',
);
app = replaceRequired(
  app,
  '        <Stat label="Gross spending" value={formatMoney(summary.grossSpending)} tone="amber" sub="Before refunds" onClick={onTransactions} />',
  '        <Stat label="Gross spending" value={formatMoney(summary.grossSpending)} tone="amber" sub="Recorded spending" onClick={onTransactions} />',
  'overview spending subtitle',
);
app = replaceRequired(
  app,
  '        <Stat label="Available" value={formatMoney(summary.available)} tone={summary.available >= 0 ? \'green\' : \'red\'} sub="Income + refunds − bills − spending" />',
  '        <Stat label="Available" value={formatMoney(summary.available)} tone={summary.available >= 0 ? \'green\' : \'red\'} sub="Income − bills − spending" />',
  'overview available subtitle',
);
app = replaceRequired(
  app,
  '        <div className="sub">Calculated from recorded income, refunds, fixed bills and gross spending. Transfers and card repayments marked as excluded do not change this figure.</div>',
  '        <div className="sub">Calculated from recorded income, fixed bills and gross spending. Transfers and card repayments marked as excluded do not change this figure.</div>',
  'savings surplus explanation',
);
app = replaceRequired(
  app,
  '        <Stat label={`${year} refunds`} value={formatMoney(annual.refunds)} tone="green" sub="Credits returned" />\n',
  '',
  'year refunds card',
);
app = replaceRequired(
  app,
  '        <Stat label={`${year} gross spending`} value={formatMoney(annual.grossSpending)} tone="amber" sub="Before refunds" />',
  '        <Stat label={`${year} gross spending`} value={formatMoney(annual.grossSpending)} tone="amber" sub="Recorded spending" />',
  'year spending subtitle',
);
app = replaceRequired(
  app,
  '        <Stat label={`${year} available`} value={formatMoney(annual.available)} tone={annual.available >= 0 ? \'green\' : \'red\'} sub="Income + refunds − bills − spending" />',
  '        <Stat label={`${year} available`} value={formatMoney(annual.available)} tone={annual.available >= 0 ? \'green\' : \'red\'} sub="Income − bills − spending" />',
  'year available subtitle',
);
app = replaceRequired(
  app,
  "  const needsCategory = type === 'expense' || type === 'refund';",
  "  const needsCategory = type === 'expense';",
  'transaction modal category rule',
);
app = replaceRequired(
  app,
  '      <p className="rule-note">Enter each source separately, including one-off rewards or sales. Refunds belong in Transactions, not income.</p>',
  '      <p className="rule-note">Enter each source separately, including one-off rewards or sales.</p>',
  'income guidance',
);
await writeFile('src/App.jsx', app);

let catalog = await readFile('src/catalog.js', 'utf8');
catalog = replaceRequired(
  catalog,
  "  { id: 'refund', label: 'Refund / credit', impact: 'Adds money back' },\n",
  '',
  'refund transaction treatment',
);
await writeFile('src/catalog.js', catalog);

let audit = await readFile('scripts/source-audit.mjs', 'utf8');
audit = replaceRequired(
  audit,
  "  assert.match(files.catalog, /card_repayment/);\n}",
  "  assert.match(files.catalog, /card_repayment/);\n  assert.doesNotMatch(files.app, /<Stat label=\"Refunds \\/ credits\"/, 'Overview must not show a refunds card.');\n  assert.doesNotMatch(files.app, /\\$\\{year\\} refunds/, 'Year view must not show a refunds card.');\n  assert.doesNotMatch(files.catalog, /id: 'refund', label:/, 'Refund entry must not be offered in the user interface.');\n}",
  'refund UI regression checks',
);
await writeFile('scripts/source-audit.mjs', audit);

let main = await readFile('src/main.jsx', 'utf8');
main = main.replace("import './overview-cleanup.css';\n", '');
await writeFile('src/main.jsx', main);

const releaseVersion = '2026-07-20-refund-free-ui-v1';
const version = JSON.parse(await readFile('public/version.json', 'utf8'));
version.version = releaseVersion;
await writeFile('public/version.json', `${JSON.stringify(version, null, 2)}\n`);

const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
manifest.start_url = `/penny-budget/?v=${releaseVersion}`;
await writeFile('public/manifest.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);

await rm('src/overview-cleanup.css', { force: true });
await rm('scripts/apply-refund-free-ui.mjs', { force: true });
await rm('.github/workflows/apply-refund-free-ui.yml', { force: true });
