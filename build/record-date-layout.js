function fail(message) {
  throw new Error(`[record-date-layout] ${message}`);
}

function lineStart(source, index) {
  const newline = source.lastIndexOf('\n', index);
  return newline < 0 ? 0 : newline;
}

function fallbackDateBlock() {
  return `<div className="field">
        <label htmlFor="record-date">Exact date</label>
        <input
          id="record-date"
          type="date"
          value={date}
          disabled={!dateConfirmed}
          onChange={(event) => {
            setDate(event.target.value);
            if (event.target.value) setDateConfirmed(true);
          }}
        />
      </div>
      <label className="evidence-toggle">
        <input
          type="checkbox"
          checked={!dateConfirmed}
          onChange={(event) => {
            const unknown = event.target.checked;
            setDateConfirmed(!unknown);
            if (unknown) setDate('');
          }}
        />
        <span><strong>Exact date not confirmed</strong><small>Penny will show “Date TBC” and use the 1st internally only to keep the record in the selected month.</small></span>
      </label>`;
}

function conditionalDateBlock(mode, dateBlock) {
  return `\n      {mode === '${mode}' && (\n        <>\n${dateBlock.trim()}\n        </>\n      )}\n`;
}

function assertBranchOrder(modalSource, branchMarker, firstMarker, dateMarker, afterMarker, label) {
  const branchStart = modalSource.indexOf(branchMarker);
  const first = modalSource.indexOf(firstMarker, branchStart);
  const date = modalSource.indexOf(dateMarker, first);
  const after = modalSource.indexOf(afterMarker, date);
  if (!(branchStart >= 0 && first > branchStart && date > first && after > date)) {
    fail(`${label} Exact date controls are not in the intended position.`);
  }
}

function transformRecordEditorContext(source) {
  const recordModalStart = source.indexOf('function RecordModal(');
  const referenceSelectStart = source.indexOf('\nfunction ReferenceSelect(', recordModalStart);
  if (!(recordModalStart >= 0 && referenceSelectStart > recordModalStart)) fail('Could not locate RecordModal for editor context.');

  let output = source;
  const lockedMarker = '  const lockedMode = Boolean(existing);\n';
  const contextBlock = `  const recordContext = existing\n    ? \`${'${income ? \'Income\' : transaction?.type === \'expense\' ? \'Expense\' : \'Transfer\'}'} · ${'${transaction?.desc || income?.description || \'Untitled\'}'} · ${'${income?.amountConfirmed === false ? \'Amount TBC\' : formatMoney(Number(transaction?.amount ?? income?.amount ?? 0))}'}\`\n    : '';\n`;

  if (!output.slice(recordModalStart, referenceSelectStart).includes('const recordContext = existing')) {
    const lockedPos = output.indexOf(lockedMarker, recordModalStart);
    if (!(lockedPos >= recordModalStart && lockedPos < referenceSelectStart)) fail('Could not find RecordModal locked-mode state.');
    const insertAt = lockedPos + lockedMarker.length;
    output = output.slice(0, insertAt) + contextBlock + output.slice(insertAt);
  }

  const recordModalOpen = "<SimpleModal title={existing ? 'Edit record' : 'Add record'} onClose={onClose}>";
  const contextualRecordModalOpen = "<SimpleModal title={existing ? 'Edit record' : 'Add record'} subtitle={recordContext} onClose={onClose}>";
  const updatedRecordStart = output.indexOf('function RecordModal(');
  const updatedReferenceStart = output.indexOf('\nfunction ReferenceSelect(', updatedRecordStart);
  const modalSource = output.slice(updatedRecordStart, updatedReferenceStart);
  if (!modalSource.includes('subtitle={recordContext}')) {
    const openPos = output.indexOf(recordModalOpen, updatedRecordStart);
    if (!(openPos >= updatedRecordStart && openPos < updatedReferenceStart)) fail('Could not add record context to SimpleModal.');
    output = output.slice(0, openPos) + contextualRecordModalOpen + output.slice(openPos + recordModalOpen.length);
  }

  const simpleSignature = 'function SimpleModal({ title, onClose, children, wide = false }) {';
  const contextualSignature = "function SimpleModal({ title, subtitle = '', onClose, children, wide = false }) {";
  if (!output.includes(contextualSignature)) {
    if (!output.includes(simpleSignature)) fail('Could not extend SimpleModal with a subtitle.');
    output = output.replace(simpleSignature, contextualSignature);
  }

  const headMarkup = `        <div className="modal-head">\n          <h2 className="section-title" id={titleId}>{title}</h2>\n          <button ref={closeRef} className="secondary-button" onClick={onClose}>Done</button>\n        </div>`;
  const contextualHeadMarkup = `        <div className="modal-head">\n          <div className="modal-head-copy">\n            <h2 className="section-title" id={titleId}>{title}</h2>\n            {subtitle && <div className="modal-context">{subtitle}</div>}\n          </div>\n          <button ref={closeRef} className="secondary-button" onClick={onClose}>Done</button>\n        </div>`;
  if (!output.includes('className="modal-context"')) {
    if (!output.includes(headMarkup)) fail('Could not add persistent record context to the modal header.');
    output = output.replace(headMarkup, contextualHeadMarkup);
  }

  const finalModalStart = output.indexOf('function RecordModal(');
  const finalReferenceStart = output.indexOf('\nfunction ReferenceSelect(', finalModalStart);
  const finalModal = output.slice(finalModalStart, finalReferenceStart);
  if (!finalModal.includes('const recordContext = existing')) fail('Record context was not created.');
  if (!finalModal.includes('subtitle={recordContext}')) fail('Record context was not attached to the editor header.');
  if (!output.includes('{subtitle && <div className="modal-context">{subtitle}</div>}')) fail('SimpleModal does not render the record context.');

  return output;
}

export function transformRecordDateLayout(source) {
  if (!source.includes('function RecordModal(')) return source;

  const recordModalStart = source.indexOf('function RecordModal(');
  const referenceSelectStart = source.indexOf('\nfunction ReferenceSelect(', recordModalStart);
  if (referenceSelectStart < 0) fail('Could not locate the end of RecordModal.');
  const originalModal = source.slice(recordModalStart, referenceSelectStart);

  for (const required of ['dateConfirmed', 'setDateConfirmed', 'setDate', 'const [date']) {
    if (!originalModal.includes(required)) fail(`RecordModal is missing required date state: ${required}.`);
  }

  const exactDateLabel = '<label htmlFor="record-date">Exact date</label>';
  const expenseMarker = "{mode === 'expense' && (";
  const incomeMarker = "{mode === 'income' && (";
  const movementMarker = "{mode === 'movement' && (";

  let output = source;
  let dateBlock = fallbackDateBlock();
  const exactDateLabelPos = output.indexOf(exactDateLabel, recordModalStart);

  if (exactDateLabelPos >= 0 && exactDateLabelPos < referenceSelectStart) {
    const dateFieldPos = output.lastIndexOf('<div className="field">', exactDateLabelPos);
    if (dateFieldPos < recordModalStart) fail('Could not find the Exact date field wrapper.');
    const dateStart = lineStart(output, dateFieldPos);
    const expenseMarkerPos = output.indexOf(expenseMarker, exactDateLabelPos);
    if (expenseMarkerPos < 0) fail('Could not find the Expense branch after the existing Exact date controls.');
    const expenseStart = lineStart(output, expenseMarkerPos);
    const extracted = output.slice(dateStart, expenseStart);
    if (!extracted.includes('Exact date not confirmed') || !extracted.includes('id="record-date"')) {
      fail('The existing Exact date block is incomplete.');
    }
    dateBlock = extracted.trim();
    output = output.slice(0, dateStart) + output.slice(expenseStart);
  }

  const nextRecordModalStart = output.indexOf('function RecordModal(');
  const nextReferenceSelectStart = output.indexOf('\nfunction ReferenceSelect(', nextRecordModalStart);
  const expenseBranchPos = output.indexOf(expenseMarker, nextRecordModalStart);
  const incomeBranchPos = output.indexOf(incomeMarker, nextRecordModalStart);
  if (!(expenseBranchPos > nextRecordModalStart && expenseBranchPos < nextReferenceSelectStart)) fail('Could not find the Expense branch.');
  if (!(incomeBranchPos > nextRecordModalStart && incomeBranchPos < nextReferenceSelectStart)) fail('Could not find the Income branch.');

  // Keep transfer date evidence intact without any DOM scrolling or focus mutation.
  const movementInsert = lineStart(output, expenseBranchPos);
  output = output.slice(0, movementInsert)
    + conditionalDateBlock('movement', dateBlock)
    + output.slice(movementInsert);

  const expenseStart = output.indexOf(expenseMarker, nextRecordModalStart);
  const categoryLabel = '<label htmlFor="record-category">Category</label>';
  const categoryPos = output.indexOf(categoryLabel, expenseStart);
  if (categoryPos < 0) fail('Could not find the Expense Category field.');
  const expenseTypePos = output.indexOf('<fieldset className="choice-group">', categoryPos);
  if (expenseTypePos < 0) fail('Could not find Expense type after Category.');
  const expenseInsert = lineStart(output, expenseTypePos);
  output = output.slice(0, expenseInsert)
    + conditionalDateBlock('expense', dateBlock)
    + output.slice(expenseInsert);

  const incomeStart = output.indexOf(incomeMarker, nextRecordModalStart);
  const incomeTypeLabel = '<label htmlFor="income-type">Income type</label>';
  const incomeTypePos = output.indexOf(incomeTypeLabel, incomeStart);
  if (incomeTypePos < 0) fail('Could not find the Income type field.');
  const receivedGridPos = output.indexOf('<div className="form-grid">', incomeTypePos);
  if (receivedGridPos < 0) fail('Could not find Received By / Account after Income type.');
  const incomeInsert = lineStart(output, receivedGridPos);
  output = output.slice(0, incomeInsert)
    + conditionalDateBlock('income', dateBlock)
    + output.slice(incomeInsert);

  const finalRecordModalStart = output.indexOf('function RecordModal(');
  const finalReferenceSelectStart = output.indexOf('\nfunction ReferenceSelect(', finalRecordModalStart);
  const modal = output.slice(finalRecordModalStart, finalReferenceSelectStart);

  const dateControlCount = (modal.match(/id="record-date"/g) || []).length;
  if (dateControlCount !== 3) fail(`Expected 3 mode-specific Exact date controls, found ${dateControlCount}.`);
  const tbcControlCount = (modal.match(/Exact date not confirmed/g) || []).length;
  if (tbcControlCount !== 3) fail(`Expected 3 mode-specific Exact date TBC controls, found ${tbcControlCount}.`);

  assertBranchOrder(modal, expenseMarker, categoryLabel, exactDateLabel, '<legend>Expense type</legend>', 'Expense');
  assertBranchOrder(modal, incomeMarker, incomeTypeLabel, exactDateLabel, 'label="Received By"', 'Income');

  const movementStart = modal.indexOf(movementMarker);
  const movementDate = modal.indexOf(exactDateLabel, movementStart);
  if (!(movementStart >= 0 && movementDate > movementStart)) fail('Transfer Exact date controls were lost.');

  return transformRecordEditorContext(output);
}

export function recordDateLayoutPlugin() {
  return {
    name: 'penny-record-editor-layout-v62',
    enforce: 'pre',
    transform(source, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null;
      return {
        code: transformRecordDateLayout(source),
        map: null,
      };
    },
  };
}
