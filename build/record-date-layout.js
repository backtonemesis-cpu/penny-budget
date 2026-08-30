function fail(message) {
  throw new Error(`[record-date-layout] ${message}`);
}

function lineStart(source, index) {
  const newline = source.lastIndexOf('\n', index);
  return newline < 0 ? 0 : newline;
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

export function transformRecordDateLayout(source) {
  if (!source.includes('function RecordModal(')) return source;

  const exactDateLabel = '<label htmlFor="record-date">Exact date</label>';
  const exactDateLabelPos = source.indexOf(exactDateLabel);
  if (exactDateLabelPos < 0) fail('Could not find the existing Exact date controls.');

  const dateFieldPos = source.lastIndexOf('<div className="field">', exactDateLabelPos);
  if (dateFieldPos < 0) fail('Could not find the Exact date field wrapper.');
  const dateStart = lineStart(source, dateFieldPos);

  const expenseMarker = "{mode === 'expense' && (";
  const expenseMarkerPos = source.indexOf(expenseMarker, exactDateLabelPos);
  if (expenseMarkerPos < 0) fail('Could not find the Expense branch after the Exact date controls.');
  const expenseStart = lineStart(source, expenseMarkerPos);

  const dateBlock = source.slice(dateStart, expenseStart);
  if (!dateBlock.includes('Exact date not confirmed') || !dateBlock.includes('id="record-date"')) {
    fail('The extracted Exact date block is incomplete.');
  }

  let output = source.slice(0, dateStart)
    + conditionalDateBlock('movement', dateBlock)
    + source.slice(expenseStart);

  const nextExpenseStart = output.indexOf(expenseMarker);
  const categoryLabel = '<label htmlFor="record-category">Category</label>';
  const categoryPos = output.indexOf(categoryLabel, nextExpenseStart);
  if (categoryPos < 0) fail('Could not find the Expense Category field.');
  const expenseTypePos = output.indexOf('<fieldset className="choice-group">', categoryPos);
  if (expenseTypePos < 0) fail('Could not find Expense type after Category.');
  const expenseInsert = lineStart(output, expenseTypePos);
  output = output.slice(0, expenseInsert)
    + conditionalDateBlock('expense', dateBlock)
    + output.slice(expenseInsert);

  const incomeMarker = "{mode === 'income' && (";
  const incomeStart = output.indexOf(incomeMarker);
  if (incomeStart < 0) fail('Could not find the Income branch.');
  const incomeTypeLabel = '<label htmlFor="income-type">Income type</label>';
  const incomeTypePos = output.indexOf(incomeTypeLabel, incomeStart);
  if (incomeTypePos < 0) fail('Could not find the Income type field.');
  const receivedGridPos = output.indexOf('<div className="form-grid">', incomeTypePos);
  if (receivedGridPos < 0) fail('Could not find Received By / Account after Income type.');
  const incomeInsert = lineStart(output, receivedGridPos);
  output = output.slice(0, incomeInsert)
    + conditionalDateBlock('income', dateBlock)
    + output.slice(incomeInsert);

  const recordModalStart = output.indexOf('function RecordModal(');
  const referenceSelectStart = output.indexOf('\nfunction ReferenceSelect(', recordModalStart);
  const recordModalSource = output.slice(recordModalStart, referenceSelectStart);

  const dateControlCount = (recordModalSource.match(/id="record-date"/g) || []).length;
  if (dateControlCount !== 3) fail(`Expected 3 mode-specific Exact date controls, found ${dateControlCount}.`);
  const tbcControlCount = (recordModalSource.match(/Exact date not confirmed/g) || []).length;
  if (tbcControlCount !== 3) fail(`Expected 3 mode-specific Exact date TBC controls, found ${tbcControlCount}.`);

  assertBranchOrder(
    recordModalSource,
    expenseMarker,
    categoryLabel,
    exactDateLabel,
    '<legend>Expense type</legend>',
    'Expense',
  );
  assertBranchOrder(
    recordModalSource,
    incomeMarker,
    incomeTypeLabel,
    exactDateLabel,
    'label="Received By"',
    'Income',
  );

  const movementMarker = "{mode === 'movement' && (";
  const movementStart = recordModalSource.indexOf(movementMarker);
  const movementDate = recordModalSource.indexOf(exactDateLabel, movementStart);
  if (!(movementStart >= 0 && movementDate > movementStart)) fail('Transfer Exact date controls were lost.');

  return output;
}

export function recordDateLayoutPlugin() {
  return {
    name: 'penny-record-date-layout-v61',
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
