import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/App.jsx';
let app = await readFile(path, 'utf8');

if (!app.includes('PENNY_V45_CLEAN_SLATE')) {
  const transferTab = `          <button role="tab" aria-selected={mode === 'movement'} className={mode === 'movement' ? 'active' : ''} onClick={() => setMode('movement')}>Transfer</button>\n`;
  if (!app.includes(transferTab)) throw new Error('v45 could not find the remaining Transfer tab in Add record.');
  app = app.replace(transferTab, '');

  const movementPanelStart = app.indexOf("      {mode === 'movement' && (\n        <div className=\"field\">");
  const expensePanelStart = app.indexOf("      {mode === 'expense' && (", movementPanelStart);
  if (movementPanelStart < 0 || expensePanelStart < 0) throw new Error('v45 could not isolate the Transfer-only form panel.');
  app = app.slice(0, movementPanelStart) + app.slice(expensePanelStart);

  const movementAccount = `      {mode === 'movement' && <ReferenceSelect id="movement-account" label="Account / card" value={account} options={accountOptions} onChange={setAccount} />}\n\n`;
  if (!app.includes(movementAccount)) throw new Error('v45 could not find the Transfer account field.');
  app = app.replace(movementAccount, '');

  const projectedSavings = `  const displayedSavingsAccounts = [\n    ...masterSavingsAccounts.map((master) => savingsAccounts.find((item) => item.id === master.id) || { ...master, balance: 0 }),\n    ...savingsAccounts.filter((item) => !masterSavingsAccounts.some((master) => master.id === item.id)),\n  ];`;
  if (!app.includes(projectedSavings)) throw new Error('v45 could not find the Savings master-list projection that pre-populates blank months.');
  app = app.replace(projectedSavings, `  const displayedSavingsAccounts = savingsAccounts; // PENNY_V45_CLEAN_SLATE: only records explicitly stored for this month are shown.`);
}

if (app.includes("onClick={() => setMode('movement')}>Transfer</button>")) throw new Error('v45 failed: Transfer tab is still visible in Add record.');
if (app.includes('id="movement-type"')) throw new Error('v45 failed: Transfer-only movement form is still rendered.');
if (app.includes('id="movement-account"')) throw new Error('v45 failed: Transfer account field is still rendered.');
if (!app.includes('const displayedSavingsAccounts = savingsAccounts; // PENNY_V45_CLEAN_SLATE')) throw new Error('v45 failed: fresh months can still inherit Savings rows from Settings.');

await writeFile(path, app);
console.log('PENNY_V45_CLEAN_SLATE applied');
