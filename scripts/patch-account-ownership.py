from pathlib import Path
import re


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact match, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


def replace_regex(path, pattern, replacement):
    file = Path(path)
    text = file.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, found {count}: {pattern[:100]!r}")
    file.write_text(updated)


# ---------------------------------------------------------------------------
# Finance/state schema: accounts have an explicit owner reference.
# ---------------------------------------------------------------------------
replace_once('src/finance.js', 'export const CURRENT_STATE_VERSION = 8;', 'export const CURRENT_STATE_VERSION = 9;')

replace_once(
    'src/finance.js',
    """function normaliseReferenceList(value, prefix) {
  if (!Array.isArray(value)) return [];
  return uniqueById(value.flatMap((item) => {
    const label = cleanText(item?.label, '', 80);
    const id = cleanText(item?.id, '', 120);
    if (!label || !id || id === 'unassigned' || id === 'household') return [];
    return [{ id: id || createId(prefix), label }];
  }));
}
""",
    """function normaliseReferenceList(value, prefix) {
  if (!Array.isArray(value)) return [];
  return uniqueById(value.flatMap((item) => {
    const label = cleanText(item?.label, '', 80);
    const id = cleanText(item?.id, '', 120);
    if (!label || !id || id === 'unassigned' || id === 'household') return [];
    if (prefix === 'account') {
      return [{
        id: id || createId(prefix),
        label,
        ownerId: cleanText(item?.ownerId, 'unassigned', 120) || 'unassigned',
      }];
    }
    return [{ id: id || createId(prefix), label }];
  }));
}
""",
)

replace_once(
    'src/finance.js',
    "return [{ id, label, balance: nonNegativeNumber(item?.balance) }];\n      }))])",
    "return [{ id, label, balance: nonNegativeNumber(item?.balance), ownerId: cleanText(item?.ownerId, 'unassigned', 120) || 'unassigned', ownerLabel: cleanText(item?.ownerLabel, '', 80) }];\n      }))])",
)

# Preserve account-owner snapshots on financial records created after this release.
replace_once(
    'src/finance.js',
    """    accountLabel: cleanText(transaction.accountLabel, '', 80),
    confirmationIssues,
""",
    """    accountLabel: cleanText(transaction.accountLabel, '', 80),
    accountOwnerId: cleanText(transaction.accountOwnerId, '', 120),
    accountOwnerLabel: cleanText(transaction.accountOwnerLabel, '', 80),
    confirmationIssues,
""",
)
replace_once(
    'src/finance.js',
    """    accountLabel: cleanText(record.accountLabel, '', 80),
    confirmationIssues,
""",
    """    accountLabel: cleanText(record.accountLabel, '', 80),
    accountOwnerId: cleanText(record.accountOwnerId, '', 120),
    accountOwnerLabel: cleanText(record.accountOwnerLabel, '', 80),
    confirmationIssues,
""",
)

# Transfer-plan rows resolve owner from the current account master first, then the
# month bank-balance snapshot. This makes an owner correction take effect at once.
replace_once(
    'src/finance.js',
    "  const bankBalances = bankBalanceMap(state, monthKey);\n  const accountPlan = new Map();",
    "  const bankBalances = bankBalanceMap(state, monthKey);\n  const masterAccounts = Object.fromEntries((state?.accounts || []).map((account) => [account.id, account]));\n  const accountPlan = new Map();",
)
replace_once(
    'src/finance.js',
    """    const key = row.account || 'unassigned';
    const bankBalance = bankBalances[key];
    const current = accountPlan.get(key) || {
      key,
      account: key,
      accountLabel: row.accountLabel || bankBalance?.label,
      amount: 0,
""",
    """    const key = row.account || 'unassigned';
    const bankBalance = bankBalances[key];
    const masterAccount = masterAccounts[key];
    const masterOwner = masterAccount?.ownerId || 'unassigned';
    const ownerId = masterOwner !== 'unassigned' ? masterOwner : bankBalance?.ownerId || 'unassigned';
    const current = accountPlan.get(key) || {
      key,
      account: key,
      accountLabel: row.accountLabel || bankBalance?.label || masterAccount?.label,
      ownerId,
      ownerLabel: masterOwner !== 'unassigned' ? '' : bankBalance?.ownerLabel || '',
      amount: 0,
""",
)
replace_once(
    'src/finance.js',
    "  const hasUnconfirmedBankBalances = accountFundingPlan.some((row) => !row.hasCurrentBalance);\n  const totalTransferNeeded = sumMoney(accountFundingPlan.map((row) => row.transferNeeded));",
    "  const hasUnconfirmedBankBalances = accountFundingPlan.some((row) => !row.hasCurrentBalance);\n  const hasUnconfirmedAccountOwners = accountFundingPlan.some((row) => !row.ownerId || row.ownerId === 'unassigned');\n  const totalTransferNeeded = sumMoney(accountFundingPlan.map((row) => row.transferNeeded));",
)
replace_once(
    'src/finance.js',
    "    accountFundingPlan,\n    hasUnconfirmedBankBalances,\n    totalTransferNeeded,",
    "    accountFundingPlan,\n    hasUnconfirmedBankBalances,\n    hasUnconfirmedAccountOwners,\n    totalTransferNeeded,",
)

# ---------------------------------------------------------------------------
# Reducer: normalize owners, preserve them in monthly bank-balance snapshots,
# and prevent deleting a person who still owns a bank account.
# ---------------------------------------------------------------------------
replace_once(
    'src/state.js',
    """      const before = state[action.field];
      const next = { ...state, [action.field]: action.items };
      return appendAudit(next, action, { action: 'update', entityType: action.field, label: action.field === 'people' ? 'Household people' : 'Accounts', before, after: action.items });
""",
    """      const before = state[action.field];
      const items = action.field === 'accounts'
        ? action.items.map((item) => ({ ...item, ownerId: item?.ownerId || 'unassigned' }))
        : action.items;
      const next = { ...state, [action.field]: items };
      return appendAudit(next, action, { action: 'update', entityType: action.field, label: action.field === 'people' ? 'Household people' : 'Accounts', before, after: items });
""",
)
replace_once(
    'src/state.js',
    ".map((item) => ({ id: item.id, label: item.label, balance: positiveNumber(item?.balance) }))",
    ".map((item) => ({ id: item.id, label: item.label, balance: positiveNumber(item?.balance), ownerId: item?.ownerId || 'unassigned', ownerLabel: item?.ownerLabel || '' }))",
)
replace_once(
    'src/state.js',
    """    return Object.values(state.txnsByMonth).some((rows) => rows.some((transaction) => transaction.paidBy === referenceId))
      || Object.values(state.incomeByMonth).some((rows) => rows.some((record) => record.receivedBy === referenceId));
""",
    """    return Object.values(state.txnsByMonth).some((rows) => rows.some((transaction) => transaction.paidBy === referenceId))
      || Object.values(state.incomeByMonth).some((rows) => rows.some((record) => record.receivedBy === referenceId))
      || (state.accounts || []).some((account) => account.ownerId === referenceId);
""",
)

# ---------------------------------------------------------------------------
# Import merge: explicit incoming ownership can fill TBC but cannot overwrite a
# confirmed owner already in the user's Penny state.
# ---------------------------------------------------------------------------
merge_by_id = """function mergeById(existing = [], incoming = []) {
  const merged = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (item?.id && !merged.has(item.id)) merged.set(item.id, item);
  });
  return [...merged.values()];
}
"""
replace_once(
    'src/storage.js',
    merge_by_id,
    merge_by_id + """
function mergeAccountsById(existing = [], incoming = []) {
  const merged = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (!item?.id) return;
    const current = merged.get(item.id);
    if (!current) {
      merged.set(item.id, item);
      return;
    }
    const currentOwner = current.ownerId || 'unassigned';
    const incomingOwner = item.ownerId || 'unassigned';
    if (currentOwner === 'unassigned' && incomingOwner !== 'unassigned') {
      merged.set(item.id, { ...current, ownerId: incomingOwner });
    }
  });
  return [...merged.values()];
}
""",
)
replace_once('src/storage.js', 'accounts: mergeById(current.accounts, incoming.accounts),', 'accounts: mergeAccountsById(current.accounts, incoming.accounts),')

# ---------------------------------------------------------------------------
# App: owner-aware account options and display labels.
# ---------------------------------------------------------------------------
replace_once(
    'src/App.jsx',
    """  const peopleOptions = useMemo(() => [...state.people, ...SPECIAL_PEOPLE], [state.people]);
  const accountOptions = useMemo(() => [...state.accounts, ...SPECIAL_ACCOUNTS], [state.accounts]);
  const peopleMap = useMemo(() => makeReferenceMap(state.people, SPECIAL_PEOPLE), [state.people]);
  const accountMap = useMemo(() => makeReferenceMap(state.accounts, SPECIAL_ACCOUNTS), [state.accounts]);
""",
    """  const peopleOptions = useMemo(() => [...state.people, ...SPECIAL_PEOPLE], [state.people]);
  const peopleMap = useMemo(() => makeReferenceMap(state.people, SPECIAL_PEOPLE), [state.people]);
  const accountOwnerOptions = useMemo(() => [...state.people, { id: 'household', label: 'Joint' }, { id: 'unassigned', label: 'TBC' }], [state.people]);
  const accountOptions = useMemo(() => [
    ...state.accounts.map((account) => ({
      ...account,
      ownerLabel: accountOwnerLabel(account, peopleMap),
      displayLabel: ownedAccountLabel(account, peopleMap),
    })),
    ...SPECIAL_ACCOUNTS,
  ], [state.accounts, peopleMap]);
  const accountMap = useMemo(() => makeReferenceMap(state.accounts, SPECIAL_ACCOUNTS), [state.accounts]);
""",
)

# Pass maps/options into Savings and Settings.
replace_regex(
    'src/App.jsx',
    r'(<Savings\s+state=\{state\}.*?canEdit=\{canEditMonth\}\s*)(mutate=\{mutate\})',
    r'\1peopleMap={peopleMap}\n            \2',
)
replace_once(
    'src/App.jsx',
    "          allCategories={allCategories}\n          recoveryRequired={recoveryRequired}",
    "          allCategories={allCategories}\n          accountOwnerOptions={accountOwnerOptions}\n          recoveryRequired={recoveryRequired}",
)
replace_once(
    'src/App.jsx',
    'function Savings({ state, summary, monthKey, month, year, canEdit, mutate }) {',
    'function Savings({ state, summary, monthKey, month, year, canEdit, peopleMap, mutate }) {',
)
replace_once(
    'src/App.jsx',
    "const nextRow = { id: account.id, label: account.label, balance: Math.max(0, Number(balance) || 0) };",
    "const nextRow = { id: account.id, label: account.label, balance: Math.max(0, Number(balance) || 0), ownerId: account.ownerId || 'unassigned', ownerLabel: accountOwnerLabel(account, peopleMap) };",
)
replace_regex(
    'src/App.jsx',
    r'(balance=\{bankBalanceMap\[account\.id\]\?\.balance\}\s*)(canEdit=\{canEdit\})',
    r'\1peopleMap={peopleMap}\n              \2',
)
replace_once(
    'src/App.jsx',
    'function BankBalanceEditor({ account, balance, canEdit, onCommit }) {',
    'function BankBalanceEditor({ account, balance, peopleMap, canEdit, onCommit }) {',
)
replace_once(
    'src/App.jsx',
    '<div className="row-title">{account.label}</div>\n        <div className="muted">Current balance before savings top-up</div>',
    '<div className="row-title">{ownedAccountLabel(account, peopleMap)}</div>\n        <div className="muted">Current balance before savings top-up</div>',
)

# Account dropdowns use owner-qualified display text but retain the raw account ID.
replace_once(
    'src/App.jsx',
    '{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}',
    '{options.map((item) => <option key={item.id} value={item.id}>{item.displayLabel || item.label}</option>)}',
)

# Snapshot account owner on newly saved/edited records. Existing snapshot remains
# unchanged while the account ID is unchanged.
replace_once(
    'src/App.jsx',
    """          accountLabel: preservedOrSelectedLabel(income?.account, income?.accountLabel, account, accountOptions),
          confirmationIssues: issues,
""",
    """          accountLabel: preservedOrSelectedLabel(income?.account, income?.accountLabel, account, accountOptions),
          ...preservedOrSelectedAccountOwner(income, account, accountOptions),
          confirmationIssues: issues,
""",
)
replace_once(
    'src/App.jsx',
    """        accountLabel: preservedOrSelectedLabel(transaction?.account, transaction?.accountLabel, account, accountOptions),
        confirmationIssues: issues,
""",
    """        accountLabel: preservedOrSelectedLabel(transaction?.account, transaction?.accountLabel, account, accountOptions),
        ...preservedOrSelectedAccountOwner(transaction, account, accountOptions),
        confirmationIssues: issues,
""",
)

# Settings Accounts gets an explicit Owner selector.
replace_once(
    'src/App.jsx',
    'function SettingsModal({ state, allCategories, recoveryRequired, rollbackAvailable, mutate, fileRef, onImport, onExport, onRestorePreviousImport, onErase, onClose }) {',
    'function SettingsModal({ state, allCategories, accountOwnerOptions, recoveryRequired, rollbackAvailable, mutate, fileRef, onImport, onExport, onRestorePreviousImport, onErase, onClose }) {',
)
replace_regex(
    'src/App.jsx',
    r'<section className="settings-section">\s*<h3>Accounts</h3>\s*<p className="section-note">Renaming an account changes future choices; historical records keep their saved account label\.</p>\s*<ReferenceEditor field="accounts" items=\{state\.accounts\} state=\{state\} mutate=\{mutate\} placeholder="Account name" />\s*</section>',
    '<section className="settings-section">\n            <h3>Accounts</h3>\n            <p className="section-note">Every bill-paying account has an explicit owner: a household person, Joint, or TBC. Existing accounts stay TBC until you confirm them.</p>\n            <AccountReferenceEditor items={state.accounts} ownerOptions={accountOwnerOptions} state={state} mutate={mutate} />\n          </section>',
)

# Owner-qualified display throughout transaction/bill/income rows.
app_path = Path('src/App.jsx')
app_text = app_path.read_text()
app_text = app_text.replace(
    'transaction.accountLabel || accountMap[transaction.account]?.label || transaction.account',
    'ownedRecordAccountLabel(transaction, accountMap, peopleMap)',
)
app_text = app_text.replace(
    'record.accountLabel || accountMap[record.account]?.label || record.account',
    'ownedRecordAccountLabel(record, accountMap, peopleMap)',
)
app_path.write_text(app_text)

replace_once(
    'src/App.jsx',
    """                <div className="row-title">{row.accountLabel || accountMap[row.account]?.label || row.account}</div>
                <div className="muted">{row.count} unpaid item{row.count === 1 ? '' : 's'} to cover from this account</div>
""",
    """                <div className="row-title">{fundingAccountLabel(row, accountMap, peopleMap)}</div>
                <div className="muted">Account owner: {fundingOwnerLabel(row, peopleMap)} · {row.count} unpaid item{row.count === 1 ? '' : 's'} to cover</div>
""",
)

# Make owner-TBC visible as an evidence warning without hiding the valid money
# shortfall calculation.
replace_once(
    'src/App.jsx',
    """          {summary.accountFundingPlan.length ? summary.accountFundingPlan.map((row) => (
""",
    """          {summary.hasUnconfirmedAccountOwners && <div className="audit-warning compact-warning" role="note"><strong>Account owner TBC.</strong><span>Confirm each bill-paying account owner in Settings so the transfer instruction identifies the correct person.</span></div>}
          {summary.accountFundingPlan.length ? summary.accountFundingPlan.map((row) => (
""",
)

account_editor_marker = 'function ReferenceRowEditor({ item, inUse, onCommit, onRemove }) {'
account_editor = """function AccountReferenceEditor({ items, ownerOptions, state, mutate }) {
  const [newLabel, setNewLabel] = useState('');
  const [newOwnerId, setNewOwnerId] = useState('unassigned');

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    mutate({
      type: 'SET_REFERENCE_LIST',
      field: 'accounts',
      items: [...items, { id: createId('account'), label: label.slice(0, 80), ownerId: newOwnerId }],
      auditLabel: `Add ${label} account`,
    });
    setNewLabel('');
    setNewOwnerId('unassigned');
  };

  const update = (id, patch) => {
    const before = items.find((item) => item.id === id);
    if (!before) return;
    const after = { ...before, ...patch };
    if (after.label === before.label && (after.ownerId || 'unassigned') === (before.ownerId || 'unassigned')) return;
    mutate({
      type: 'SET_REFERENCE_LIST',
      field: 'accounts',
      items: items.map((item) => item.id === id ? after : item),
      auditLabel: `Update ${before.label} account details`,
    });
  };

  const remove = (id) => {
    if (referenceInUse(state, 'accounts', id)) return;
    const before = items.find((item) => item.id === id);
    mutate({
      type: 'SET_REFERENCE_LIST',
      field: 'accounts',
      items: items.filter((item) => item.id !== id),
      auditLabel: `Remove ${before?.label || 'account'}`,
    });
  };

  return (
    <>
      {items.map((item) => (
        <AccountReferenceRowEditor
          key={item.id}
          item={item}
          ownerOptions={ownerOptions}
          inUse={referenceInUse(state, 'accounts', item.id)}
          onCommit={(patch) => update(item.id, patch)}
          onRemove={() => remove(item.id)}
        />
      ))}
      <div className="settings-row account-settings-row">
        <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Account name" aria-label="Account name" />
        <select value={newOwnerId} onChange={(event) => setNewOwnerId(event.target.value)} aria-label="Account owner">
          {ownerOptions.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}
        </select>
        <button className="primary-button" disabled={!newLabel.trim()} onClick={add}>Add</button>
      </div>
    </>
  );
}

function AccountReferenceRowEditor({ item, ownerOptions, inUse, onCommit, onRemove }) {
  const [draft, setDraft] = useState(item.label);
  useEffect(() => setDraft(item.label), [item.label]);
  const commitLabel = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(item.label);
      return;
    }
    if (trimmed !== item.label) onCommit({ label: trimmed.slice(0, 80) });
  };
  return (
    <div className="settings-row account-settings-row">
      <input aria-label="Account name" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitLabel} />
      <select value={item.ownerId || 'unassigned'} onChange={(event) => onCommit({ ownerId: event.target.value })} aria-label={`${item.label} owner`}>
        {ownerOptions.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}
      </select>
      <button className="danger-button" disabled={inUse} title={inUse ? 'Used by existing records' : 'Remove'} onClick={onRemove}>{inUse ? 'In use' : 'Remove'}</button>
    </div>
  );
}

""" + account_editor_marker
replace_once('src/App.jsx', account_editor_marker, account_editor)

# Display and snapshot helpers use local data only.
helper_marker = 'function preservedOrSelectedLabel(existingId, existingLabel, nextId, options) {'
helpers = """function accountOwnerLabel(account, peopleMap) {
  const ownerId = account?.ownerId || 'unassigned';
  if (ownerId === 'household') return 'Joint';
  if (ownerId === 'unassigned') return 'TBC';
  return peopleMap[ownerId]?.label || 'TBC';
}

function ownedAccountLabel(account, peopleMap) {
  if (!account) return 'TBC · Unassigned';
  return `${accountOwnerLabel(account, peopleMap)} · ${account.label}`;
}

function ownedRecordAccountLabel(record, accountMap, peopleMap) {
  const account = accountMap[record?.account];
  const label = record?.accountLabel || account?.label || record?.account || 'Unassigned';
  if (!record?.account || record.account === 'unassigned') return label;
  const ownerLabel = record?.accountOwnerLabel
    || (record?.accountOwnerId === 'household' ? 'Joint' : record?.accountOwnerId && record.accountOwnerId !== 'unassigned' ? peopleMap[record.accountOwnerId]?.label : '')
    || accountOwnerLabel(account, peopleMap);
  return `${ownerLabel || 'TBC'} · ${label}`;
}

function fundingOwnerLabel(row, peopleMap) {
  if (row?.ownerLabel && row.ownerLabel !== 'TBC') return row.ownerLabel;
  if (row?.ownerId === 'household') return 'Joint';
  if (!row?.ownerId || row.ownerId === 'unassigned') return 'TBC';
  return peopleMap[row.ownerId]?.label || 'TBC';
}

function fundingAccountLabel(row, accountMap, peopleMap) {
  const accountLabel = row?.accountLabel || accountMap[row?.account]?.label || row?.account || 'Unassigned';
  return `${fundingOwnerLabel(row, peopleMap)} · ${accountLabel}`;
}

function preservedOrSelectedAccountOwner(existingRecord, nextAccountId, options) {
  if (existingRecord?.account === nextAccountId && existingRecord?.accountOwnerId) {
    return {
      accountOwnerId: existingRecord.accountOwnerId,
      accountOwnerLabel: existingRecord.accountOwnerLabel || '',
    };
  }
  const account = options.find((item) => item.id === nextAccountId);
  return {
    accountOwnerId: account?.ownerId || '',
    accountOwnerLabel: account?.ownerLabel || '',
  };
}

""" + helper_marker
replace_once('src/App.jsx', helper_marker, helpers)

# ---------------------------------------------------------------------------
# Styling for account name + owner selector.
# ---------------------------------------------------------------------------
replace_once('src/styles.css', '.field input, .field select, .settings-row input {', '.field input, .field select, .settings-row input, .settings-row select {')
with Path('src/styles.css').open('a') as file:
    file.write("""

.account-settings-row { flex-wrap: wrap; }
.account-settings-row input { flex: 1 1 180px; }
.account-settings-row select { flex: 0 0 160px; }
.compact-warning { margin: 8px 0 4px; }
@media (max-width: 480px) {
  .account-settings-row input,
  .account-settings-row select,
  .account-settings-row .primary-button,
  .account-settings-row .danger-button { flex: 1 1 100%; }
}
""")

# ---------------------------------------------------------------------------
# Regression tests and source gates.
# ---------------------------------------------------------------------------
replace_once(
    'scripts/self-test.mjs',
    "accounts: [{ id: 'a1', label: 'Account 1' }, { id: 'a2', label: 'Account 2' }],",
    "accounts: [{ id: 'a1', label: 'Account 1', ownerId: 'p1' }, { id: 'a2', label: 'Account 2', ownerId: 'p2' }],",
)
replace_once(
    'scripts/self-test.mjs',
    "assert.equal(july.accountFundingPlan[0].hasCurrentBalance, false, 'Missing bank balances must not be treated as confirmed zero evidence.');",
    "assert.equal(july.accountFundingPlan[0].hasCurrentBalance, false, 'Missing bank balances must not be treated as confirmed zero evidence.');\nassert.equal(july.accountFundingPlan[0].ownerId, 'p2', 'Transfer rows must identify the bank-account owner.');\nassert.equal(july.hasUnconfirmedAccountOwners, false);",
)
replace_once(
    'scripts/self-test.mjs',
    "accounts: [{ id: 'a1', label: 'Account 1' }],\n  bankBalancesByMonth: {\n    '2026-10': [{ id: 'a1', label: 'Account 1', balance: 60 }],",
    "people: [{ id: 'p1', label: 'Person 1' }, { id: 'p2', label: 'Person 2' }],\n  accounts: [{ id: 'a1', label: 'Account 1', ownerId: 'p1' }],\n  bankBalancesByMonth: {\n    '2026-10': [{ id: 'a1', label: 'Account 1', balance: 60, ownerId: 'p1', ownerLabel: 'Person 1' }],",
)
replace_once(
    'scripts/self-test.mjs',
    "assert.equal(monthSummary(fundingPlanState, '2026-10').hasUnconfirmedBankBalances, false);",
    "assert.equal(monthSummary(fundingPlanState, '2026-10').hasUnconfirmedBankBalances, false);\nassert.equal(fundingPlan[0].ownerId, 'p1');\nassert.equal(monthSummary(fundingPlanState, '2026-10').hasUnconfirmedAccountOwners, false);",
)
replace_once(
    'scripts/self-test.mjs',
    "items: [{ id: 'a1', label: 'Account 1', balance: 72.345 }],",
    "items: [{ id: 'a1', label: 'Account 1', balance: 72.345, ownerId: 'p1', ownerLabel: 'Person 1' }],",
)
replace_once(
    'scripts/self-test.mjs',
    "assert.equal(changedBankBalance.bankBalancesByMonth['2026-10'][0].balance, 72.35, 'Bill-paying bank balances must be normalised to pennies.');",
    "assert.equal(changedBankBalance.bankBalancesByMonth['2026-10'][0].balance, 72.35, 'Bill-paying bank balances must be normalised to pennies.');\nassert.equal(changedBankBalance.bankBalancesByMonth['2026-10'][0].ownerId, 'p1', 'Bank-balance snapshots must preserve account ownership.');",
)

legacy_marker = 'const legacyUncertain = normaliseTransaction({'
replace_once(
    'scripts/self-test.mjs',
    legacy_marker,
    """const ownerMigration = migrateState({
  version: 8,
  people: [{ id: 'p1', label: 'Person 1' }],
  accounts: [
    { id: 'owned', label: 'Owned Account', ownerId: 'p1' },
    { id: 'legacy-account', label: 'Legacy Account' },
  ],
}, new Date(2026, 8, 1));
assert.equal(ownerMigration.version, CURRENT_STATE_VERSION);
assert.equal(ownerMigration.accounts.find((account) => account.id === 'owned').ownerId, 'p1');
assert.equal(ownerMigration.accounts.find((account) => account.id === 'legacy-account').ownerId, 'unassigned', 'Legacy accounts must migrate to Owner TBC rather than being guessed.');

const ownerSnapshotTxn = normaliseTransaction({
  id: 'owner-snapshot', type: 'expense', date: '2026-09-01', amount: 10, desc: 'Owned bill', category: 'other', paid: false,
  paidBy: 'p1', account: 'a1', accountLabel: 'Account 1', accountOwnerId: 'p1', accountOwnerLabel: 'Person 1', confirmationIssues: [],
});
assert.equal(ownerSnapshotTxn.accountOwnerId, 'p1');
assert.equal(ownerSnapshotTxn.accountOwnerLabel, 'Person 1');

""" + legacy_marker,
)

replace_once(
    'scripts/source-audit.mjs',
    "  assert.match(files.finance, /hasUnconfirmedBankBalances/, 'Missing bank balances must keep transfer totals marked as unconfirmed.');",
    "  assert.match(files.finance, /hasUnconfirmedBankBalances/, 'Missing bank balances must keep transfer totals marked as unconfirmed.');\n  assert.match(files.finance, /ownerId/, 'Accounts and transfer rows must carry ownership metadata.');\n  assert.match(files.finance, /accountOwnerId/, 'Financial records must snapshot account-owner evidence.');\n  assert.match(files.finance, /hasUnconfirmedAccountOwners/, 'Transfer planning must expose owner TBC state.');\n  assert.match(files.storage, /mergeAccountsById/, 'Imports must not overwrite a confirmed account owner.');",
)
replace_once(
    'scripts/source-audit.mjs',
    '  assert.match(files.app, /Bill-Paying Bank Balances/);',
    "  assert.match(files.app, /Bill-Paying Bank Balances/);\n  assert.match(files.app, /Every bill-paying account has an explicit owner/);\n  assert.match(files.app, /AccountReferenceEditor/);\n  assert.match(files.app, /ownedAccountLabel/);\n  assert.match(files.app, /Account owner:/);\n  assert.match(files.app, /preservedOrSelectedAccountOwner/);",
)

# ---------------------------------------------------------------------------
# Release metadata and Change Log.
# ---------------------------------------------------------------------------
Path('public/version.json').write_text('{\n  "version": "2026-08-29-account-ownership-v1"\n}\n')
manifest = Path('public/manifest.webmanifest').read_text()
manifest = re.sub(r'\?v=[^" ]+', '?v=2026-08-29-account-ownership-v1', manifest, count=1)
Path('public/manifest.webmanifest').write_text(manifest)

changelog = Path('CHANGELOG.md').read_text()
heading = '# Penny Change Log\n\n'
entry = """## 29 August 2026 — Explicit bank-account ownership

- Added an Owner field to every bill-paying account using local household person, Joint or TBC references.
- Existing accounts migrate to Owner TBC; Penny never infers ownership from transaction usage.
- Account ownership is visible in Settings, account choices, Transactions, Bills, Savings and the Start-of-Month Transfer Plan.
- New financial records snapshot the account owner alongside the account label so later owner changes do not rewrite historical evidence.
- Monthly bank-balance snapshots preserve ownership metadata for transfer planning.
- Month imports may fill a TBC owner from explicit evidence but cannot overwrite an already-confirmed owner.
- Account-owner edits are recorded in Change History.
- No household identities or private ownership assignments are embedded in the public repository.

"""
if heading not in changelog:
    raise SystemExit('CHANGELOG heading missing')
Path('CHANGELOG.md').write_text(changelog.replace(heading, heading + entry, 1))

# Structural assertions before npm tests.
for path, terms in {
    'src/finance.js': ['CURRENT_STATE_VERSION = 9', 'hasUnconfirmedAccountOwners', 'accountOwnerId'],
    'src/state.js': ['ownerLabel', 'account.ownerId === referenceId'],
    'src/storage.js': ['mergeAccountsById'],
    'src/App.jsx': ['AccountReferenceEditor', 'ownedAccountLabel', 'Account owner:', 'accountOwnerOptions', 'preservedOrSelectedAccountOwner'],
}.items():
    text = Path(path).read_text()
    for term in terms:
        if term not in text:
            raise SystemExit(f'{path}: expected term missing after patch: {term}')

print('Account ownership patch applied successfully')
