import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/App.jsx';
let app = await readFile(path, 'utf8');

if (!app.includes('PENNY_V44_NO_TRANSFER_UI')) {
  const auditStart = app.indexOf('      <details className="card disclosure-card audit-movements">');
  if (auditStart >= 0) {
    const auditEndMarker = '      </details>\n';
    const auditEnd = app.indexOf(auditEndMarker, auditStart);
    if (auditEnd < 0) throw new Error('v44 could not find audit movements disclosure end');
    app = app.slice(0, auditStart) + '      {/* PENNY_V44_NO_TRANSFER_UI */}\n' + app.slice(auditEnd + auditEndMarker.length);
  }

  const movementsStart = app.indexOf("      {tab === 'movements' && (");
  if (movementsStart >= 0) {
    const componentEndMarker = '    </>\n  );\n}\n\nfunction ExpenseRow';
    const componentEnd = app.indexOf(componentEndMarker, movementsStart);
    if (componentEnd < 0) throw new Error('v44 could not isolate legacy movements block');
    app = app.slice(0, movementsStart) + app.slice(componentEnd);
  }

  app = app.replace(/\n\s*<button[^>]*onClick=\{\(\) => setKind\('transfer'\)\}[^>]*>Transfer<\/button>/g, '');
  app = app.replace(/\n\s*<button[^>]*aria-selected=\{kind === 'transfer'\}[^>]*>Transfer<\/button>/g, '');
  app = app.replace(/\n\s*\{kind === 'transfer' && \([\s\S]*?\n\s*\)\}/g, '');

  app = app.replace(
    'function SavingsAccountEditor({ account, month, year, canEdit, onCommit }) {',
    'function SavingsAccountEditor({ account, month, year, canEdit, onCommit, onRemove }) {',
  );

  const savingsStart = app.indexOf('function Savings({');
  if (savingsStart < 0) throw new Error('v44 could not find Savings component');
  const editorStart = app.indexOf('function SavingsAccountEditor({', savingsStart);
  if (editorStart < 0) throw new Error('v44 could not find SavingsAccountEditor');
  const savingsComponent = app.slice(savingsStart, editorStart);
  if (!savingsComponent.includes('const removeAccount = (id) =>')) throw new Error('v44 expected existing month-scoped Savings removal logic');

  const rowInvocation = `            onCommit={(patch) => updateAccount(account.id, patch)}\n          />`;
  if (app.includes(rowInvocation)) {
    app = app.replace(rowInvocation, `            onCommit={(patch) => updateAccount(account.id, patch)}\n            onRemove={() => removeAccount(account.id)}\n          />`);
  }

  const actionsAnchor = `            {editing ? (\n              <>\n                <button className="secondary-button" onClick={() => { setBalance(String(account.balance || '')); setEditing(false); }}>Cancel</button>\n                <button className="primary-button" onClick={save}>Save</button>\n              </>\n            ) : <button className="secondary-button" onClick={() => setEditing(true)}>Edit</button>}`;
  if (!app.includes(actionsAnchor)) throw new Error('v44 could not find Savings actions');
  app = app.replace(actionsAnchor, `${actionsAnchor}\n            <button className="danger-button" onClick={onRemove}>Delete</button>`);
}

if (app.includes('Transfers & excluded movements')) throw new Error('v44 failed: Transfers disclosure still present');
if (/setKind\('transfer'\)/.test(app)) throw new Error('v44 failed: Transfer add-tab wiring still present');
if (!app.includes('onRemove={() => removeAccount(account.id)}')) throw new Error('v44 failed: Savings row delete wiring missing');
if (!app.includes('className="danger-button" onClick={onRemove}>Delete</button>')) throw new Error('v44 failed: Savings Delete button missing');

await writeFile(path, app);
console.log('PENNY_V44_NO_TRANSFER_UI applied');
