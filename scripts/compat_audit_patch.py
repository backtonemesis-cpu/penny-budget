from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    'src/finance.js',
    """  const monthMeta = state?.monthMetaByMonth?.[monthKey] || {};
  const isComplete = monthMeta.status === 'complete';
  const startingSavingsConfirmed = Boolean(isComplete && monthMeta.startingSavingsConfirmed);
  const startingSavings = startingSavingsConfirmed ? nonNegativeNumber(monthMeta.startingSavings) : 0;
""",
    """  const monthMeta = state?.monthMetaByMonth?.[monthKey] || {};
  const isComplete = monthMeta.status === 'complete';
  const rawStartingSavings = monthMeta.startingSavings;
  const hasStartingSavingsValue = Object.hasOwn(monthMeta, 'startingSavings')
    && (typeof rawStartingSavings === 'number' || (typeof rawStartingSavings === 'string' && rawStartingSavings.trim() !== ''))
    && Number.isFinite(Number(rawStartingSavings))
    && Number(rawStartingSavings) >= 0;
  const startingSavingsConfirmed = Boolean(isComplete && hasStartingSavingsValue && monthMeta.startingSavingsConfirmed !== false);
  const startingSavings = startingSavingsConfirmed ? nonNegativeNumber(rawStartingSavings) : 0;
""",
    'starting savings compatibility logic',
)

replace_once(
    'scripts/source-audit.mjs',
    """  assert.match(files.finance, /expectedClosingSavings\\s*=\\s*isComplete \\? roundMoney\\(startingSavings \\+ income - expenses\\)/, 'Completed months must reconcile starting savings plus income less expenses.');
""",
    """  assert.match(files.finance, /expectedClosingSavings\\s*=\\s*startingSavingsConfirmed \\? roundMoney\\(startingSavings \\+ income - expenses\\)/, 'Completed months must reconcile only when starting-savings evidence is confirmed.');
""",
    'source audit expected closing rule',
)

replace_once(
    'scripts/source-audit.mjs',
    """  assert.match(files.finance, /auditReady\\s*=\\s*Boolean\\(isComplete && incompleteRecords === 0 && !reconciliationProblem && hasSavingsSnapshot\\)/, 'Only completed, reconciled, fully confirmed months may be audit-ready.');
""",
    """  assert.match(files.finance, /auditReady\\s*=\\s*Boolean\\(isComplete && startingSavingsConfirmed && incompleteRecords === 0 && !reconciliationProblem && hasSavingsSnapshot\\)/, 'Only completed, reconciled, fully confirmed months with starting-savings evidence may be audit-ready.');
  assert.match(files.finance, /Object\\.hasOwn\\(monthMeta, 'startingSavings'\\)/, 'Starting-savings confirmation must distinguish a missing field from an explicit zero.');
  assert.match(files.finance, /monthMeta\\.startingSavingsConfirmed !== false/, 'Older valid starting-savings evidence must remain compatible unless explicitly marked unconfirmed.');
""",
    'source audit readiness rule',
)

replace_once(
    'scripts/final-audit-test.mjs',
    """  CURRENT_STATE_VERSION,
  annualSummary,
  createBlankState,
""",
    """  CURRENT_STATE_VERSION,
  annualSummary,
  createBlankState,
  migrateState,
  monthSummary,
""",
    'final audit imports',
)

replace_once(
    'scripts/final-audit-test.mjs',
    """assert.equal(emptyYear.evidenceStatus, 'empty', 'An empty year must not be described as Ready or Review.');

const subPennySavings = appReducer(createBlankState(), {
""",
    """assert.equal(emptyYear.evidenceStatus, 'empty', 'An empty year must not be described as Ready or Review.');

const explicitZeroStart = migrateState({
  ...createBlankState(),
  monthMetaByMonth: { '2026-01': { status: 'complete', startingSavings: 0 } },
}, new Date(2026, 0, 31));
assert.equal(monthSummary(explicitZeroStart, '2026-01').startingSavingsConfirmed, true, 'An explicit zero starting balance is valid evidence.');

const missingStart = migrateState({
  ...createBlankState(),
  monthMetaByMonth: { '2026-02': { status: 'complete' } },
  savingsByMonth: { '2026-02': [{ id: 's0', label: 'Savings', balance: 0 }] },
}, new Date(2026, 1, 28));
const missingStartSummary = monthSummary(missingStart, '2026-02');
assert.equal(missingStartSummary.startingSavingsConfirmed, false, 'Missing starting savings must remain TBC rather than becoming a synthetic zero.');
assert.equal(missingStartSummary.expectedClosingSavings, null);
assert.equal(missingStartSummary.auditReady, false);

const rawLegacyComplete = {
  ...createBlankState(),
  monthMetaByMonth: { '2026-03': { status: 'complete', startingSavings: 8000 } },
  savingsByMonth: { '2026-03': [{ id: 's1', label: 'Savings', balance: 8000 }] },
};
assert.equal(monthSummary(rawLegacyComplete, '2026-03').startingSavingsConfirmed, true, 'Existing valid pre-flag state must remain compatible.');

const subPennySavings = appReducer(createBlankState(), {
""",
    'final audit starting savings cases',
)

changelog = Path('CHANGELOG.md')
text = changelog.read_text()
marker = '## 28 August 2026 — Audit hardening and mobile UX rebuild\n'
if marker not in text:
    raise SystemExit('CHANGELOG audit-hardening section not found')
addition = '- Preserved backward compatibility for completed months that already contain a valid starting-savings value while keeping genuinely missing starting-savings evidence as `TBC`; an explicit £0 remains valid evidence.\n'
if addition not in text:
    text = text.replace(marker, marker + '\n' + addition, 1)
changelog.write_text(text)

print('Compatibility audit patch applied')
