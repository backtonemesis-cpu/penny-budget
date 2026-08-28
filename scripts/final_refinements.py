from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new, 1))


app = 'src/App.jsx'

replace_once(app, '''    const duplicate = targetRows.find((existing) => isLikelyDuplicateTransaction(existing, transaction));
    if (duplicate) {
      setMessage(`Possible duplicate blocked: “${transaction.desc}” for ${formatMoney(transaction.amount)} already exists on that date.`);
      return false;
    }
''', '''    const duplicate = targetRows.find((existing) => isLikelyDuplicateTransaction(existing, transaction));
    if (duplicate && !globalThis.confirm(`Possible duplicate: “${transaction.desc}” for ${formatMoney(transaction.amount)} already exists on that date. Save this second record anyway?`)) {
      setMessage('Duplicate save cancelled. Existing record was left unchanged.');
      return false;
    }
''', 'expense duplicate override')

replace_once(app, '''    const duplicate = targetRows.find((existing) => isLikelyDuplicateIncome(existing, income));
    if (duplicate) {
      setMessage(`Possible duplicate blocked: “${income.description}” for ${formatMoney(income.amount)} already exists on that date.`);
      return false;
    }
''', '''    const duplicate = targetRows.find((existing) => isLikelyDuplicateIncome(existing, income));
    if (duplicate && !globalThis.confirm(`Possible duplicate: “${income.description}” for ${formatMoney(income.amount)} already exists on that date. Save this second record anyway?`)) {
      setMessage('Duplicate save cancelled. Existing record was left unchanged.');
      return false;
    }
''', 'income duplicate override')

replace_once(app, '''      const backupPackage = parseBackupPackage(await file.text());
      if (!recoveryRequired) {
        const rollbackResult = saveRollbackState(browserStorage, state);
        if (!rollbackResult.ok) {
          setMessage(`${rollbackResult.error} Export a manual backup before importing.`);
          return;
        }
        setRollbackAvailable(true);
      }

      if (backupPackage.importMode === 'merge_months') {
''', '''      const backupPackage = parseBackupPackage(await file.text());
      const createRollbackAfterApproval = () => {
        if (recoveryRequired) return true;
        const rollbackResult = saveRollbackState(browserStorage, state);
        if (!rollbackResult.ok) {
          setMessage(`${rollbackResult.error} Export a manual backup before importing.`);
          return false;
        }
        setRollbackAvailable(true);
        return true;
      };

      if (backupPackage.importMode === 'merge_months') {
''', 'defer rollback creation')

replace_once(app, '''        if (!globalThis.confirm(`Merge ${label} into Penny? Existing records for the imported month will be replaced, but all other months will be preserved. Penny has created an automatic pre-import recovery copy.`)) return;
        const restored = mergeImportedMonths(state, backupPackage.state, backupPackage.mergeMonths);
''', '''        if (!globalThis.confirm(`Merge ${label} into Penny? Existing records for the imported month will be replaced, but all other months will be preserved. Penny will create an automatic pre-import recovery copy after you approve.`)) return;
        if (!createRollbackAfterApproval()) return;
        const restored = mergeImportedMonths(state, backupPackage.state, backupPackage.mergeMonths);
''', 'month merge rollback timing')

replace_once(app, '''      if (!globalThis.confirm('Replace the current Penny data with this backup? Penny has created an automatic pre-import recovery copy.')) return;
      setSaveEnabled(true);
''', '''      if (!globalThis.confirm('Replace the current Penny data with this backup? Penny will create an automatic pre-import recovery copy after you approve.')) return;
      if (!createRollbackAfterApproval()) return;
      setSaveEnabled(true);
''', 'full restore rollback timing')

replace_once(app, '''            {visible.map((entry) => (
              <div className="history-row" key={entry.id}>
                <div className="grow">
                  <div className="row-title">{auditActionLabel(entry.action)} · {entry.label}</div>
                  <div className="muted">{formatAuditTime(entry.at)}{entry.monthKey ? ` · ${entry.monthKey}` : ''}</div>
                </div>
                <span className="status-pill neutral">{entry.entityType}</span>
              </div>
            ))}
''', '''            {visible.map((entry) => (
              <details className="history-row" key={entry.id}>
                <summary className="history-summary">
                  <div className="grow">
                    <div className="row-title">{auditActionLabel(entry.action)} · {entry.label}</div>
                    <div className="muted">{formatAuditTime(entry.at)}{entry.monthKey ? ` · ${entry.monthKey}` : ''}</div>
                  </div>
                  <span className="status-pill neutral">{entry.entityType}</span>
                </summary>
                <div className="history-details">
                  <AuditSnapshot title="Before" value={entry.before} />
                  <AuditSnapshot title="After" value={entry.after} />
                </div>
              </details>
            ))}
''', 'inspectable change history')

replace_once(app, '''function ReferenceEditor({ field, items, state, mutate, placeholder }) {
''', '''function AuditSnapshot({ title, value }) {
  if (!value) return <div className="history-snapshot"><div className="mini-label">{title}</div><div className="muted">Not applicable</div></div>;
  return (
    <div className="history-snapshot">
      <div className="mini-label">{title}</div>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function ReferenceEditor({ field, items, state, mutate, placeholder }) {
''', 'audit snapshot component')

replace_once(app, '''      <section className="card" aria-labelledby="savings-goal-title">
        <h2 className="section-title" id="savings-goal-title">Savings Goal</h2>
        <div className="form-grid">
          <NumberField label="Goal" value={state.savingsGoal} onCommit={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsGoal', value })} />
          <NumberField label="Monthly Contribution" value={state.savingsContrib} onCommit={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsContrib', value })} />
        </div>
        <SummaryRow label="Remaining" value={goalRemaining ?? 0} />
        <div className="row"><div className="grow">Forecast</div><div>{state.savingsGoal ? (goalRemaining === 0 ? 'Goal reached' : months ? `${months} months` : 'Set monthly contribution') : 'Set a goal'}</div></div>
      </section>
''', '''      {!summary.isComplete && (
        <section className="card" aria-labelledby="savings-goal-title">
          <h2 className="section-title" id="savings-goal-title">Savings Goal</h2>
          <div className="form-grid">
            <NumberField label="Goal" value={state.savingsGoal} onCommit={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsGoal', value })} />
            <NumberField label="Monthly Contribution" value={state.savingsContrib} onCommit={(value) => mutate({ type: 'SET_SAVINGS', field: 'savingsContrib', value })} />
          </div>
          <SummaryRow label="Remaining" value={goalRemaining ?? 0} />
          <div className="row"><div className="grow">Forecast</div><div>{state.savingsGoal ? (goalRemaining === 0 ? 'Goal reached' : months ? `${months} months` : 'Set monthly contribution') : 'Set a goal'}</div></div>
        </section>
      )}
''', 'hide current planning from completed months')

styles = Path('src/styles.css')
css = styles.read_text()
old_css = '''.history-row { display: flex; align-items: center; gap: 9px; border-bottom: 1px solid var(--border-soft); padding: 10px 0; }
.history-row:last-child { border-bottom: 0; }
'''
new_css = '''.history-row { display: block; border-bottom: 1px solid var(--border-soft); padding: 0; }
.history-row:last-child { border-bottom: 0; }
.history-summary { display: flex; align-items: center; gap: 9px; cursor: pointer; list-style: none; padding: 10px 0; }
.history-summary::-webkit-details-marker { display: none; }
.history-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 0 0 10px; }
.history-snapshot { min-width: 0; border: 1px solid var(--border-soft); border-radius: 10px; padding: 9px; background: var(--surface-2); }
.history-snapshot pre { max-height: 220px; overflow: auto; margin: 7px 0 0; color: var(--muted); font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
'''
if css.count(old_css) != 1:
    raise SystemExit('history styles marker mismatch')
styles.write_text(css.replace(old_css, new_css, 1))

audit = Path('scripts/source-audit.mjs')
text = audit.read_text()
old = '''  assert.doesNotMatch(files.index, /maximum-scale\\s*=\\s*1/i, 'Page zoom must not be artificially capped.');
  assert.match(files.app, /label="Paid By"/);
'''
new = '''  assert.doesNotMatch(files.index, /maximum-scale\\s*=\\s*1/i, 'Page zoom must not be artificially capped.');
  assert.match(files.index, /Content-Security-Policy/, 'A restrictive browser Content Security Policy must remain present.');
  assert.match(files.index, /object-src 'none'/, 'CSP must block plugin/object content.');
  assert.match(files.index, /referrer.*no-referrer/, 'Financial app must not leak navigation referrers.');
  assert.match(files.app, /label="Paid By"/);
'''
if text.count(old) != 1:
    raise SystemExit('CSP audit insertion marker mismatch')
text = text.replace(old, new, 1)
text = text.replace("assert.match(files.app, /Possible duplicate blocked/);", "assert.match(files.app, /Save this second record anyway\\?/);\n  assert.match(files.app, /createRollbackAfterApproval/);\n  assert.match(files.app, /<AuditSnapshot title=\"Before\"/);\n  assert.match(files.app, /!summary\\.isComplete && \\(/, 'Current savings-goal planning must be hidden from completed historical months.');")
text = text.replace("  index: await read('../index.html'),", "  index: await read('../index.html'),\n  lockfile: await read('../package-lock.json'),")
text = text.replace("  assert.match(files.storage, /monthMetaByMonth/);", "  assert.match(files.storage, /monthMetaByMonth/);\n  assert.match(files.lockfile, /\\\"postcss\\\": \\{[\\s\\S]*?\\\"version\\\": \\\"8\\.5\\.23\\\"/, 'PostCSS must remain on the patched 8.5.23 release.');\n  assert.match(files.lockfile, /Tm\\+gbfC0aHu1tBA\\/JvKQh32S0K6YgCHkiAF4\\/W6xX0K0RmNuc94VeK419dJoE65R5aRxmo\\+noZQSWrAMF6yb6g==/, 'Darwin x64 lockfile integrity must remain exact.');")
audit.write_text(text)

# Temporary maintenance files must not survive the final branch.
Path('.github/workflows/one-off-lockfile-repair.yml').unlink(missing_ok=True)
Path('.github/workflows/one-off-final-refinements.yml').unlink(missing_ok=True)
Path('scripts/final_refinements.py').unlink(missing_ok=True)
