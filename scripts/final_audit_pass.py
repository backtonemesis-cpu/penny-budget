from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new, 1))


replace_once('src/finance.js', '''  const reconciliationProblem = Boolean(isComplete && (Math.abs(closingVariance || 0) >= 0.005 || remainingBills > 0));

  return {
''', '''  const reconciliationProblem = Boolean(isComplete && (Math.abs(closingVariance || 0) >= 0.005 || remainingBills > 0));
  const evidenceComplete = incompleteExpenses + incompleteIncome === 0;
  const auditReady = isComplete && evidenceComplete && !reconciliationProblem;

  return {
''', 'month audit readiness calculation')

replace_once('src/finance.js', '''    reconciliationProblem,
    auditReady: incompleteExpenses + incompleteIncome === 0 && !reconciliationProblem,
    hasData: incomeRecords.length > 0 || transactions.length > 0 || hasSavingsSnapshot || isComplete,
''', '''    reconciliationProblem,
    evidenceComplete,
    auditReady,
    hasData: incomeRecords.length > 0 || transactions.length > 0 || hasSavingsSnapshot || isComplete,
''', 'month audit readiness return')

replace_once('src/finance.js', '''  const incompleteRecords = withData.reduce((sum, item) => sum + item.incompleteRecords, 0);
  const monthsNeedingReview = withData.filter((item) => !item.auditReady).length;
  const unreconciledMonths = withData.filter((item) => item.reconciliationProblem).length;
  return {
    months,
    withData,
    ...totals,
    incompleteRecords,
    monthsNeedingReview,
    unreconciledMonths,
    auditReady: incompleteRecords === 0 && unreconciledMonths === 0,
  };
''', '''  const incompleteRecords = withData.reduce((sum, item) => sum + item.incompleteRecords, 0);
  const openMonths = withData.filter((item) => !item.isComplete).length;
  const monthsNeedingReview = withData.filter((item) => item.isComplete && !item.auditReady).length;
  const unreconciledMonths = withData.filter((item) => item.reconciliationProblem).length;
  const hasData = withData.length > 0;
  return {
    months,
    withData,
    ...totals,
    incompleteRecords,
    openMonths,
    monthsNeedingReview,
    unreconciledMonths,
    hasData,
    auditReady: hasData && openMonths === 0 && monthsNeedingReview === 0,
  };
''', 'annual finality calculation')

replace_once('src/App.jsx', '''  const exportBackup = () => {
    const blob = new Blob([createBackupText(state)], { type: 'application/json' });
''', '''  const exportBackup = () => {
    if (recoveryRequired) {
      setMessage('Normal backup export is disabled while stored data is unreadable. Import a known-good backup or erase the damaged local copy first.');
      return;
    }
    const blob = new Blob([createBackupText(state)], { type: 'application/json' });
''', 'recovery export guard')

replace_once('src/App.jsx', '''      {summary.isComplete && !canEditMonth && (
        <div className="locked-banner" role="note">
          <div>
            <strong>Completed month — locked</strong>
            <span>Historical figures are protected from accidental editing.</span>
          </div>
          <button className="secondary-button" onClick={onUnlockMonth}>Unlock corrections</button>
        </div>
      )}

      {summary.incompleteRecords > 0 && (
''', '''      {summary.isComplete && !canEditMonth && (
        <div className="locked-banner" role="note">
          <div>
            <strong>Completed month — locked</strong>
            <span>Historical figures are protected from accidental editing.</span>
          </div>
          <button className="secondary-button" onClick={onUnlockMonth}>Unlock corrections</button>
        </div>
      )}
      {summary.isComplete && canEditMonth && <div className="status-banner" role="status">Completed month is temporarily unlocked for corrections. Every change is recorded in Change History.</div>}
      {!summary.isComplete && <div className="status-banner" role="status">Open month — live planning only. It is not final mortgage evidence until the month is completed and reconciled.</div>}

      {summary.incompleteRecords > 0 && (
''', 'month finality banners')

replace_once('src/App.jsx', '''    const nextBalance = Math.max(0, Number(balance) || 0);
''', '''    const rawBalance = Math.max(0, Number(balance) || 0);
    const nextBalance = Math.round((rawBalance + Number.EPSILON) * 100) / 100;
''', 'savings input penny rounding')

replace_once('src/App.jsx', '''      {!annual.auditReady && (
        <div className="audit-warning" role="note">
          <strong>{year} is not audit-ready yet.</strong>
          <span>{annual.incompleteRecords} record{annual.incompleteRecords === 1 ? '' : 's'} need confirmation across {annual.monthsNeedingReview} month{annual.monthsNeedingReview === 1 ? '' : 's'}{annual.unreconciledMonths ? `; ${annual.unreconciledMonths} completed month reconciliation${annual.unreconciledMonths === 1 ? '' : 's'} also need review` : ''}.</span>
        </div>
      )}
''', '''      {annual.hasData && !annual.auditReady && (
        <div className="audit-warning" role="note">
          <strong>{year} is not final mortgage evidence yet.</strong>
          <span>{annual.openMonths} open month{annual.openMonths === 1 ? '' : 's'}; {annual.monthsNeedingReview} completed month{annual.monthsNeedingReview === 1 ? '' : 's'} need review; {annual.incompleteRecords} unresolved record flag{annual.incompleteRecords === 1 ? '' : 's'}.</span>
        </div>
      )}
      {!annual.hasData && <div className="status-banner">No financial records or savings snapshots are stored for {year}.</div>}
''', 'year finality warning')

replace_once('src/App.jsx', '''        <Stat variant="compact" label="Audit Status" value={annual.auditReady ? 'Ready' : 'Review'} tone={annual.auditReady ? 'green' : 'amber'} sub={annual.auditReady ? 'No unresolved record flags' : `${annual.incompleteRecords} record flags`} />
''', '''        <Stat variant="compact" label="Audit Status" value={!annual.hasData ? 'No data' : annual.auditReady ? 'Ready' : annual.openMonths ? 'Open' : 'Review'} tone={annual.auditReady ? 'green' : 'amber'} sub={!annual.hasData ? 'Nothing to assess' : annual.auditReady ? 'All stored months are completed and reconciled' : annual.openMonths ? `${annual.openMonths} month${annual.openMonths === 1 ? '' : 's'} still open` : `${annual.monthsNeedingReview} completed month${annual.monthsNeedingReview === 1 ? '' : 's'} need review`} />
''', 'year audit status card')

replace_once('src/App.jsx', '''            {item.hasData && <span className={`status-pill ${item.auditReady ? 'success' : 'warning'}`}>{item.auditReady ? 'Ready' : 'Review'}</span>}
''', '''            {item.hasData && <span className={`status-pill ${item.auditReady ? 'success' : 'warning'}`}>{item.auditReady ? 'Ready' : item.isComplete ? 'Review' : 'Open'}</span>}
''', 'month status badge')

replace_once('src/App.jsx', '''          <button className="primary-button" onClick={onExport}>Export backup</button>
''', '''          <button className="primary-button" disabled={recoveryRequired} title={recoveryRequired ? 'Unavailable while saved browser data is unreadable' : 'Export Penny backup'} onClick={onExport}>Export backup</button>
''', 'disable misleading recovery export')

# Tighten CSP websocket allowance to local development only.
index = Path('index.html')
text = index.read_text()
old_csp = "connect-src 'self' ws: wss:;"
new_csp = "connect-src 'self' ws://localhost:* ws://127.0.0.1:*;"
if text.count(old_csp) != 1:
    raise SystemExit('CSP connect-src marker mismatch')
index.write_text(text.replace(old_csp, new_csp, 1))

# Add regression assertions for finality semantics.
test = Path('scripts/self-test.mjs')
text = test.read_text()
text = text.replace("assert.equal(june.auditReady, true);", "assert.equal(june.auditReady, true);\nassert.equal(june.evidenceComplete, true);")
text = text.replace("assert.equal(july.incompleteRecords, 0);", "assert.equal(july.incompleteRecords, 0);\nassert.equal(july.evidenceComplete, true);\nassert.equal(july.auditReady, false, 'An open month can have clean evidence but must not be final/audit-ready.');")
text = text.replace("assert.equal(annual.auditReady, false);", "assert.equal(annual.auditReady, false);\nassert.equal(annual.openMonths >= 1, true);")
text = text.replace("assert.equal(annual.withData.some((item) => item.key === '2026-06'), true, 'Savings or completed-month data must count as annual data.');", "assert.equal(annual.withData.some((item) => item.key === '2026-06'), true, 'Savings or completed-month data must count as annual data.');\nconst emptyAnnual = annualSummary(createBlankState(), 2030);\nassert.equal(emptyAnnual.hasData, false);\nassert.equal(emptyAnnual.auditReady, false, 'A year with no evidence must not be labelled audit-ready.');")
test.write_text(text)

# Extend source gates for these semantics.
audit = Path('scripts/source-audit.mjs')
text = audit.read_text()
text = text.replace("  assert.match(files.app, /auditReady/);", "  assert.match(files.app, /auditReady/);\n  assert.match(files.app, /Open month — live planning only/);\n  assert.match(files.app, /disabled=\\{recoveryRequired\\}/, 'Recovery mode must disable normal backup export.');\n  assert.match(files.finance, /auditReady = isComplete && evidenceComplete/, 'Only completed reconciled months may be audit-ready.');\n  assert.match(files.finance, /openMonths/, 'Annual audit status must distinguish open months from final evidence.');")
text = text.replace("  assert.match(files.index, /object-src 'none'/, 'CSP must block plugin/object content.');", "  assert.match(files.index, /object-src 'none'/, 'CSP must block plugin/object content.');\n  assert.doesNotMatch(files.index, /connect-src[^;]*\\bws:\\s+wss:/, 'CSP must not allow arbitrary WebSocket origins.');")
audit.write_text(text)

# Remove temporary maintenance files in the same commit that applies the patch.
Path('.github/workflows/one-off-final-audit.yml').unlink(missing_ok=True)
Path('scripts/final_audit_pass.py').unlink(missing_ok=True)
