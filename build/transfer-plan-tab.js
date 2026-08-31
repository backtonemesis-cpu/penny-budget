function fail(message) {
  throw new Error(`[transfer-plan-tab] ${message}`);
}

function findConditionalEnd(source, start) {
  const openParen = source.indexOf('&& (', start);
  if (openParen < 0) fail('Could not find the opening parenthesis for the transfer-plan block.');

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openParen + 3; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = '';
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        while (/\s/.test(source[end] || '')) end += 1;
        if (source[end] !== '}') fail('Transfer-plan conditional did not end with a JSX expression brace.');
        return end + 1;
      }
    }
  }

  fail('Could not find the end of the transfer-plan conditional.');
}

function overviewSummaryCard() {
  return [
    '      {!summary.isComplete && summary.expenseTransactions.length > 0 && (',
    '        <button',
    '          type="button"',
    '          className="card transfer-plan-overview-card"',
    '          onClick={onOpenTransferPlan}',
    "          aria-label={`Open Transfer Plan. ${(summary.hasUnconfirmedBankBalances || summary.hasAmbiguousFundingAccounts) ? 'Amount to transfer is still to be confirmed' : `Transfer needed ${formatMoney(summary.totalTransferNeeded)}`}`}",
    '        >',
    '          <div className="transfer-plan-overview-copy">',
    '            <span className="mini-label">Transfer Plan</span>',
    '            <strong>Start-of-month transfers</strong>',
    '          </div>',
    '          <div className="transfer-plan-overview-value">',
    "            <span className={`money ${(summary.hasUnconfirmedBankBalances || summary.hasAmbiguousFundingAccounts) ? 'amber' : summary.totalTransferNeeded > 0 ? 'amber' : 'green'}`}>{(summary.hasUnconfirmedBankBalances || summary.hasAmbiguousFundingAccounts) ? 'TBC' : formatMoney(summary.totalTransferNeeded)}</span>",
    '            <span>Transfer needed</span>',
    '          </div>',
    '          <span className="transfer-plan-overview-chevron" aria-hidden="true">›</span>',
    '        </button>',
    '      )}',
  ].join('\n');
}

function transferPlanComponent(transferBlock) {
  return `function TransferPlan({ summary, month, year, peopleMap, accountMap, monthKey, monthSetup, canEditMonth, onUnlockMonth, onStartNewMonth, onUpdateBankBalance, onAddIncome, onAddExpense, onSeparateAccount }) {
  return (
    <>
${transferBlock}
      {summary.isComplete && (
        <section className="card transfer-plan-empty" aria-labelledby="transfer-plan-complete-title">
          <h2 className="section-title" id="transfer-plan-complete-title">Transfer Plan</h2>
          <p className="section-note">This month is complete, so no start-of-month transfer plan is required.</p>
        </section>
      )}
      {!summary.isComplete && summary.expenseTransactions.length === 0 && (
        <section className="card transfer-plan-empty" aria-labelledby="transfer-plan-empty-title">
          <h2 className="section-title" id="transfer-plan-empty-title">Transfer Plan</h2>
          <p className="section-note">Add the month’s planned expenses first. Penny will then calculate how much needs moving into each bill-paying account.</p>
        </section>
      )}
    </>
  );
}

`;
}

function addOverviewNavigationProp(source) {
  const signatureStart = source.indexOf('function Overview({');
  const signatureEnd = source.indexOf('}) {', signatureStart);
  if (!(signatureStart >= 0 && signatureEnd > signatureStart)) fail('Could not isolate the Overview signature.');
  const signature = source.slice(signatureStart, signatureEnd + 4);
  if (signature.includes('onOpenTransferPlan')) return source;
  if (!signature.includes('onUpdateBankBalance')) fail('Overview no longer exposes the bank-balance update callback.');
  const updatedSignature = signature.replace('onUpdateBankBalance', 'onOpenTransferPlan, onUpdateBankBalance');
  return source.slice(0, signatureStart) + updatedSignature + source.slice(signatureEnd + 4);
}

function wireOverviewNavigation(source) {
  const mainStart = source.indexOf('<main className="content">');
  const overviewViewStart = source.indexOf("        {view === 'Overview' && (", mainStart);
  const transactionsViewStart = source.indexOf("        {view === 'Transactions' && (", overviewViewStart);
  if (!(mainStart >= 0 && overviewViewStart > mainStart && transactionsViewStart > overviewViewStart)) {
    fail('Could not isolate the Overview view wiring.');
  }
  const overviewView = source.slice(overviewViewStart, transactionsViewStart);
  if (overviewView.includes('onOpenTransferPlan=')) return source;

  const callback = 'onUpdateBankBalance={updateTransferBankBalance}';
  const callbackPos = source.indexOf(callback, overviewViewStart);
  if (!(callbackPos >= overviewViewStart && callbackPos < transactionsViewStart)) fail('Could not find the Overview bank-balance callback.');
  const lineStart = source.lastIndexOf('\n', callbackPos) + 1;
  const indent = source.slice(lineStart, callbackPos);
  const insertion = `${indent}onOpenTransferPlan={() => setView('Transfer Plan')}\n`;
  return source.slice(0, lineStart) + insertion + source.slice(lineStart);
}

function replacePrimaryNav(source) {
  const fourItemYearNav = "{['Overview', 'Transactions', 'Savings', 'Year'].map((item) => (";
  const threeItemNav = "{['Overview', 'Transactions', 'Savings'].map((item) => (";
  const transferNav = "{['Overview', 'Transactions', 'Savings', 'Transfer Plan'].map((item) => (";
  if (source.includes(transferNav)) return source;
  if (source.includes(fourItemYearNav)) return source.replace(fourItemYearNav, transferNav);
  if (source.includes(threeItemNav)) return source.replace(threeItemNav, transferNav);
  fail('Could not replace the primary navigation with Transfer Plan.');
}

export function transformTransferPlanTab(source) {
  if (!source.includes('function App()') || !source.includes('function Overview(')) return source;
  if (source.includes('function TransferPlan(') && source.includes("'Transfer Plan'].map((item)")) return source;

  const overviewStart = source.indexOf('function Overview(');
  const fundingEditorStart = source.indexOf('\nfunction FundingBalanceEditor(', overviewStart);
  if (!(overviewStart >= 0 && fundingEditorStart > overviewStart)) fail('Could not locate the Overview boundaries.');

  const transferStartMarker = '      {!summary.isComplete && summary.expenseTransactions.length > 0 && (';
  const transferStart = source.indexOf(transferStartMarker, overviewStart);
  if (!(transferStart > overviewStart && transferStart < fundingEditorStart)) fail('Could not locate the existing Start-of-Month Transfer Plan in Overview.');
  const transferEnd = findConditionalEnd(source, transferStart);
  const transferBlock = source.slice(transferStart, transferEnd);
  if (!transferBlock.includes('Start-of-Month Transfer Plan') || !transferBlock.includes('summary.accountFundingPlan')) {
    fail('The located Overview block is not the expected transfer plan.');
  }

  let output = source.slice(0, transferStart) + overviewSummaryCard() + source.slice(transferEnd);
  output = addOverviewNavigationProp(output);
  output = wireOverviewNavigation(output);

  const updatedFundingEditorStart = output.indexOf('\nfunction FundingBalanceEditor(', output.indexOf('function Overview('));
  if (updatedFundingEditorStart < 0) fail('Could not find the FundingBalanceEditor insertion point.');
  output = output.slice(0, updatedFundingEditorStart + 1)
    + transferPlanComponent(transferBlock)
    + output.slice(updatedFundingEditorStart + 1);

  const mainStart = output.indexOf('<main className="content">');
  const transactionsViewMarker = "        {view === 'Transactions' && (";
  const transactionsViewPos = output.indexOf(transactionsViewMarker, mainStart);
  if (!(mainStart >= 0 && transactionsViewPos > mainStart)) fail('Could not locate the Transactions view insertion point.');

  const transferPlanView = `        {view === 'Transfer Plan' && (
          <TransferPlan
            summary={summary}
            month={period.month}
            year={period.year}
            peopleMap={peopleMap}
            accountMap={accountMap}
            monthKey={monthKey}
            monthSetup={monthSetup}
            canEditMonth={canEditMonth}
            onUnlockMonth={unlockMonth}
            onStartNewMonth={() => setModal({ kind: 'month-setup' })}
            onUpdateBankBalance={updateTransferBankBalance}
            onAddIncome={() => openRecord({ mode: 'income' })}
            onAddExpense={() => openRecord({ mode: 'expense' })}
            onSeparateAccount={separateFundingAccount}
          />
        )}

`;
  output = output.slice(0, transactionsViewPos) + transferPlanView + output.slice(transactionsViewPos);
  output = replacePrimaryNav(output);

  const finalOverviewStart = output.indexOf('function Overview(');
  const finalTransferStart = output.indexOf('function TransferPlan(');
  const finalFundingStart = output.indexOf('function FundingBalanceEditor(');
  const finalOverview = output.slice(finalOverviewStart, finalTransferStart);
  const finalTransferPlan = output.slice(finalTransferStart, finalFundingStart);
  const transferNav = "{['Overview', 'Transactions', 'Savings', 'Transfer Plan'].map((item) => (";

  if (finalOverview.includes('Start-of-Month Transfer Plan')) fail('The full transfer plan still exists inside Overview.');
  if (!finalOverview.includes('transfer-plan-overview-card')) fail('Overview is missing the compact Transfer Plan summary.');
  if (!finalTransferPlan.includes('Start-of-Month Transfer Plan') || !finalTransferPlan.includes('summary.accountFundingPlan')) fail('The dedicated Transfer Plan view lost the existing calculation UI.');
  if (!output.includes("view === 'Transfer Plan'")) fail('The Transfer Plan view was not attached to App.');
  if (!output.includes(transferNav)) fail('The fourth primary navigation slot is not Transfer Plan.');

  return output;
}

export function transferPlanTabPlugin() {
  return {
    name: 'penny-transfer-plan-tab-v64',
    enforce: 'pre',
    transform(source, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null;
      return {
        code: transformTransferPlanTab(source),
        map: null,
      };
    },
  };
}
