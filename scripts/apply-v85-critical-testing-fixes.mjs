import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/App.jsx';
let app = await readFile(path, 'utf8');

function replaceRequired(before, after, label) {
  if (app.includes(after)) return;
  if (!app.includes(before)) throw new Error('v85 missing anchor: ' + label);
  app = app.replace(before, after);
}

if (!app.includes('PENNY_V85_EXPLICIT_MONTH_SESSION')) {
  replaceRequired(
    "const initialPeriod = currentLocalPeriod();",
    "const currentInitialPeriod = currentLocalPeriod();\nfunction storedExplicitMonth() {\n  try {\n    const value = globalThis.sessionStorage?.getItem('penny_explicit_month') || '';\n    return isValidMonthKey(value) ? value : '';\n  } catch {\n    return '';\n  }\n}\nconst initialExplicitMonth = storedExplicitMonth(); // PENNY_V85_EXPLICIT_MONTH_SESSION\nconst initialPeriod = initialExplicitMonth\n  ? (() => { const [year, month] = initialExplicitMonth.split('-').map(Number); return { year, month: month - 1, key: initialExplicitMonth }; })()\n  : currentInitialPeriod;",
    'session-restored explicit month',
  );

  replaceRequired(
    "  const followCurrentPeriodRef = useRef(true);",
    "  const followCurrentPeriodRef = useRef(!initialExplicitMonth);",
    'follow-current initial state',
  );

  replaceRequired(
    "  const setMonthValue = (value, { followCurrent = false } = {}) => {\n    if (!isValidMonthKey(value)) return;\n    followCurrentPeriodRef.current = followCurrent;\n    const [year, month] = value.split('-').map(Number);\n    setPeriod({ year, month: month - 1, key: value });\n  };",
    "  const setMonthValue = (value, { followCurrent = false } = {}) => {\n    if (!isValidMonthKey(value)) return;\n    followCurrentPeriodRef.current = followCurrent;\n    try {\n      if (followCurrent) globalThis.sessionStorage?.removeItem('penny_explicit_month');\n      else globalThis.sessionStorage?.setItem('penny_explicit_month', value);\n    } catch {\n      // Session persistence is a reload-safety enhancement only.\n    }\n    const [year, month] = value.split('-').map(Number);\n    setPeriod({ year, month: month - 1, key: value });\n  };",
    'explicit month persistence',
  );
}

// A download URL must remain alive long enough for Chromium/Safari to consume it.
// Immediate revocation can make automated and real-browser downloads disappear.
replaceRequired(
  "    anchor.click();\n    anchor.remove();\n    URL.revokeObjectURL(url);",
  "    anchor.click();\n    anchor.remove();\n    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1500);\n    setToast('Backup download started.');",
  'backup download lifetime',
);

// Distinguish new-account and existing-account controls for screen readers.
replaceRequired(
  "placeholder=\"Account name\" aria-label=\"Account name\"",
  "placeholder=\"Account name\" aria-label=\"New account name\"",
  'new account accessible name',
);
replaceRequired(
  "<input aria-label=\"Account name\" value={draft}",
  "<input aria-label={item.label + ' account name'} value={draft}",
  'existing account accessible name',
);
replaceRequired(
  "aria-label=\"Account owner\"",
  "aria-label=\"New account owner\"",
  'new account owner accessible name',
);

// Guard the primary blocker explicitly: both money-entry modes share these
// fields, and later release transforms must never remove them again.
if (!app.includes('id="record-description"') || !app.includes('id="record-amount"')) {
  throw new Error('v85 blocker: Description and Amount are missing from the final record editor.');
}
if (!app.includes("setFormError('Description is required.')")) {
  throw new Error('v85 blocker: Description validation is no longer tied to the visible Description field.');
}
if (!app.includes('!displayedSavingsAccounts.length') || app.includes('!masterSavingsAccounts.length && <div className="empty savings-settings-hint"')) {
  throw new Error('v85 blocker: Savings empty-state message does not follow the displayed month accounts.');
}

await writeFile(path, app);
console.log('PENNY_V85 critical testing fixes applied');
