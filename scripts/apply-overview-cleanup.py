from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}: {old[:100]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'Expected exactly one match in {path}, found {text.count(old)}')
    p.write_text(text.replace(old, new, 1))

app = Path('src/App.jsx')
styles = Path('src/styles.css')
source_audit = Path('scripts/source-audit.mjs')
month_audit = Path('scripts/month-setup-source-audit.mjs')
version = Path('public/version.json')
manifest = Path('public/manifest.webmanifest')
changelog = Path('CHANGELOG.md')

# Import pure Overview status helper.
replace_once(
    app,
    "import { buildRecurringBillCopies, recurringBillSelectionTotal, recurringBillSetup } from './month-setup.js';\n",
    "import { buildRecurringBillCopies, recurringBillSelectionTotal, recurringBillSetup } from './month-setup.js';\nimport { overviewActionableIncompleteCount } from './overview-status.js';\n",
)

# Add transient toast state.
replace_once(
    app,
    "  const [message, setMessage] = useState(initialLoad.warning);\n  const [saveEnabled, setSaveEnabled] = useState(!initialLoad.warning);\n",
    "  const [message, setMessage] = useState(initialLoad.warning);\n  const [toast, setToast] = useState('');\n  const [saveEnabled, setSaveEnabled] = useState(!initialLoad.warning);\n",
)

# Auto-dismiss transient toast.
replace_once(
    app,
    "  useEffect(() => {\n    if (!saveEnabled || recoveryRequired) return;\n    const result = saveState(browserStorage, state);\n    if (!result.ok) setMessage(result.error);\n  }, [state, saveEnabled, recoveryRequired]);\n\n  useEffect(() => {\n",
    "  useEffect(() => {\n    if (!saveEnabled || recoveryRequired) return;\n    const result = saveState(browserStorage, state);\n    if (!result.ok) setMessage(result.error);\n  }, [state, saveEnabled, recoveryRequired]);\n\n  useEffect(() => {\n    if (!toast) return undefined;\n    const timerId = globalThis.setTimeout(() => setToast(''), 3200);\n    return () => globalThis.clearTimeout(timerId);\n  }, [toast]);\n\n  useEffect(() => {\n",
)

# Month setup completion is a transient confirmation, not a persistent card.
replace_once(
    app,
    "      setModal(null);\n      setMessage('No new recurring bills were selected. Existing bills were left unchanged.');\n      return;\n",
    "      setModal(null);\n      setToast('No new recurring bills were selected. Existing bills were left unchanged.');\n      return;\n",
)
replace_once(
    app,
    "    setModal(null);\n    setMessage(`${copies.length} recurring bill${copies.length === 1 ? '' : 's'} copied into ${MONTHS[period.month]} ${period.year} as Unpaid. Exact dates remain TBC until confirmed.`);\n",
    "    setModal(null);\n    setToast(`${copies.length} recurring bill${copies.length === 1 ? '' : 's'} copied into ${MONTHS[period.month]} ${period.year}.`);\n",
)

# Successful backup/import restore notices are also transient.
replace_once(
    app,
    "        setModal(null);\n        setMessage(`${label} merged successfully. Other months were preserved.`);\n        return;\n",
    "        setModal(null);\n        setMessage('');\n        setToast(`${label} merged successfully. Other months were preserved.`);\n        return;\n",
)
replace_once(
    app,
    "      setModal(null);\n      setMessage('Backup imported successfully.');\n",
    "      setModal(null);\n      setMessage('');\n      setToast('Backup imported successfully.');\n",
)
replace_once(
    app,
    "      setModal(null);\n      setMessage('Penny was restored to the state immediately before the last import.');\n",
    "      setModal(null);\n      setMessage('');\n      setToast('Penny restored to the pre-import recovery copy.');\n",
)

# Render toast outside document flow so it never pushes the dashboard down.
replace_once(
    app,
    "      <main className=\"content\">\n        {message && <Notice message={message} onDismiss={() => setMessage('')} />}\n",
    "      <main className=\"content\">\n        {message && <Notice message={message} onDismiss={() => setMessage('')} />}\n",
)
replace_once(
    app,
    "      </main>\n\n      <nav className=\"nav\" aria-label=\"Primary navigation\">\n",
    "      </main>\n\n      {toast && <TemporaryToast message={toast} onDismiss={() => setToast('')} />}\n\n      <nav className=\"nav\" aria-label=\"Primary navigation\">\n",
)

# Add compact transient toast component.
replace_once(
    app,
    "function Notice({ message, onDismiss }) {\n  return (\n    <div className=\"notice\" role=\"status\">\n      <span>{message}</span>\n      <button aria-label=\"Dismiss message\" onClick={onDismiss}>×</button>\n    </div>\n  );\n}\n\nfunction Stat",
    "function Notice({ message, onDismiss }) {\n  return (\n    <div className=\"notice\" role=\"status\">\n      <span>{message}</span>\n      <button aria-label=\"Dismiss message\" onClick={onDismiss}>×</button>\n    </div>\n  );\n}\n\nfunction TemporaryToast({ message, onDismiss }) {\n  return (\n    <div className=\"temporary-toast\" role=\"status\" aria-live=\"polite\">\n      <span>{message}</span>\n      <button aria-label=\"Dismiss confirmation\" onClick={onDismiss}>×</button>\n    </div>\n  );\n}\n\nfunction Stat",
)

# Compute only genuinely actionable live-month confirmation issues.
replace_once(
    app,
    "  const sourceMonthLabel = monthSetup.sourceMonthKey\n    ? `${MONTHS[Number(monthSetup.sourceMonthKey.slice(5, 7)) - 1]} ${monthSetup.sourceMonthKey.slice(0, 4)}`\n    : 'the previous month';\n\n  return (\n",
    "  const sourceMonthLabel = monthSetup.sourceMonthKey\n    ? `${MONTHS[Number(monthSetup.sourceMonthKey.slice(5, 7)) - 1]} ${monthSetup.sourceMonthKey.slice(0, 4)}`\n    : 'the previous month';\n  const actionableIncompleteRecords = overviewActionableIncompleteCount(summary);\n\n  return (\n",
)

# Remove routine live-month newspaper banner.
replace_once(
    app,
    "      {!summary.isComplete && summary.hasData && (\n        <div className=\"status-banner\" role=\"note\">In progress — this month is planning data, not final mortgage evidence until it is completed and reconciled.</div>\n      )}\n\n",
    "",
)

# Only show a large confirmation warning when the live-month issue really needs user action.
replace_once(
    app,
    "      {summary.incompleteRecords > 0 && (\n        <div className=\"audit-warning\" role=\"note\">\n          <strong>{summary.incompleteRecords} record{summary.incompleteRecords === 1 ? '' : 's'} need confirmation.</strong>\n          <span>Unconfirmed dates, payer/receiver or accounts remain visible and prevent final evidence status.</span>\n        </div>\n      )}\n",
    "      {actionableIncompleteRecords > 0 && (\n        <div className=\"audit-warning compact-overview-warning\" role=\"note\">\n          <strong>{actionableIncompleteRecords} item{actionableIncompleteRecords === 1 ? '' : 's'} need attention</strong>\n          <span>Open Bills or Transactions to confirm the missing evidence.</span>\n        </div>\n      )}\n",
)

# Show month setup only while there is something to do; make copy deliberately concise.
old_setup = """      {!summary.isComplete && (\n        <section className=\"card month-setup-card\" aria-labelledby=\"month-setup-title\">\n          <div className=\"section-heading month-setup-heading\">\n            <div>\n              <h2 className=\"section-title\" id=\"month-setup-title\">Start New Month</h2>\n              <p className=\"section-note\">Copy recurring fixed bills from {sourceMonthLabel}. Penny previews everything first, starts every copy Unpaid, and never copies income or ordinary day-to-day spending.</p>\n            </div>\n            <button className=\"primary-button\" disabled={!canEditMonth || monthSetup.availableCount === 0} onClick={onStartNewMonth}>\n              {monthSetup.availableCount > 0 ? 'Start New Month' : monthSetup.candidates.length ? 'Bills Already Copied' : 'No Previous Bills'}\n            </button>\n          </div>\n          {monthSetup.candidates.length > 0 && (\n            <div className=\"month-setup-summary\">\n              <span>{monthSetup.availableCount} bill{monthSetup.availableCount === 1 ? '' : 's'} available to copy</span>\n              {monthSetup.duplicateCount > 0 && <span>{monthSetup.duplicateCount} already present and protected from duplication</span>}\n            </div>\n          )}\n        </section>\n      )}\n"""
new_setup = """      {!summary.isComplete && monthSetup.availableCount > 0 && (\n        <section className=\"card month-setup-card month-setup-compact\" aria-labelledby=\"month-setup-title\">\n          <div className=\"month-setup-copy\">\n            <div>\n              <h2 className=\"section-title\" id=\"month-setup-title\">Set up {MONTHS[month]}</h2>\n              <p className=\"section-note\">{monthSetup.availableCount} recurring bill{monthSetup.availableCount === 1 ? '' : 's'} available from {sourceMonthLabel}. Review before copying.</p>\n            </div>\n            <button className=\"primary-button\" disabled={!canEditMonth} onClick={onStartNewMonth}>Copy Bills</button>\n          </div>\n        </section>\n      )}\n"""
replace_once(app, old_setup, new_setup)

# Styling: compact persistent notices, floating transient toast, concise setup action.
replace_once(
    styles,
    ".notice button { min-height: 32px; border: 0; background: transparent; color: var(--text); font-size: 20px; }\n",
    ".notice { font-size: 13px; line-height: 1.4; }\n.notice button { min-height: 32px; border: 0; background: transparent; color: var(--text); font-size: 20px; }\n.temporary-toast {\n  position: fixed;\n  z-index: 60;\n  left: 50%;\n  bottom: calc(72px + env(safe-area-inset-bottom));\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: min(calc(100% - 24px), 560px);\n  gap: 10px;\n  border: 1px solid rgba(85,217,154,0.42);\n  border-radius: 13px;\n  padding: 10px 12px;\n  background: rgba(28,36,51,0.98);\n  box-shadow: var(--shadow);\n  color: var(--text);\n  font-size: 13px;\n  line-height: 1.35;\n  transform: translateX(-50%);\n}\n.temporary-toast button { min-width: 32px; min-height: 32px; border: 0; background: transparent; color: var(--muted); font-size: 20px; }\n",
)
replace_once(
    styles,
    ".attention-card { border-color: rgba(245,185,66,0.4); }\n\n.section-heading",
    ".attention-card { border-color: rgba(245,185,66,0.4); }\n.compact-overview-warning { padding: 10px 12px; }\n.month-setup-compact { padding: 12px 14px; }\n.month-setup-copy { display: flex; align-items: center; justify-content: space-between; gap: 14px; }\n.month-setup-copy .section-title { margin-bottom: 4px; font-family: inherit; font-size: 16px; font-style: normal; }\n.month-setup-copy .primary-button { flex: 0 0 auto; white-space: nowrap; }\n\n.section-heading",
)

# Existing source audit should now enforce the dashboard-first Overview design.
replace_once(
    source_audit,
    "  assert.match(files.app, /In progress — this month is planning data, not final mortgage evidence/);\n",
    "  assert.doesNotMatch(files.app, /In progress — this month is planning data, not final mortgage evidence/, 'Routine live-month status must not occupy a large Overview banner.');\n  assert.match(files.app, /overviewActionableIncompleteCount/, 'Overview must filter non-actionable planning confirmations.');\n  assert.match(files.app, /TemporaryToast/, 'Routine success confirmations must use a transient toast.');\n",
)

# Month-setup source audit: setup disappears once complete and success is transient.
replace_once(
    month_audit,
    "assert.match(app, /Start New Month/, 'Overview must expose a Start New Month action.');\n",
    "assert.match(app, /Set up \{MONTHS\[month\]\}/, 'Overview must expose a concise month setup action only when bills are available.');\nassert.match(app, /monthSetup\.availableCount > 0/, 'Completed month setup must disappear from Overview once there is nothing left to copy.');\nassert.doesNotMatch(app, /Bills Already Copied/, 'Overview must not retain a redundant Bills Already Copied panel after setup.');\nassert.match(app, /setToast\(`\$\{copies\.length\}/, 'Successful recurring-bill copy must use a transient confirmation.');\n",
)

# Release version and manifest cache bust.
version.write_text('{\n  "version": "2026-08-30-overview-cleanup-v1"\n}\n')
manifest_text = manifest.read_text()
manifest_text = manifest_text.replace('2026-08-30-unified-month-setup-v1', '2026-08-30-overview-cleanup-v1')
manifest.write_text(manifest_text)

# Changelog.
text = changelog.read_text()
entry = """## 2026-08-30 — Overview cleanup\n\n- Replaced persistent routine success cards with an auto-dismissing confirmation toast.\n- Removed the routine live-month \"In progress\" banner from Overview.\n- Date-only TBC flags created by Start New Month no longer generate a large live-month warning; the audit flags remain on the records and still count for final evidence.\n- Start New Month now appears only when recurring bills are actually available to copy and disappears after setup is complete.\n- Condensed the month setup prompt to keep Overview dashboard-first.\n\n"""
if not text.startswith(entry):
    changelog.write_text(entry + text)

print('Overview cleanup patch applied')
