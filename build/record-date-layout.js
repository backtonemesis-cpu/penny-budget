const EXACT_DATE_START = '\n      <div className="field">\n        <label htmlFor="record-date">Exact date</label>';
const EXPENSE_BRANCH = "\n      {mode === 'expense' && (";
const INCOME_BRANCH = "\n      {mode === 'income' && (";
const MOVEMENT_BRANCH = "\n      {mode === 'movement' && (";

function fail(message) {
  throw new Error(`[record-date-layout] ${message}`);
}

function conditionalDateBlock(mode, dateBlock) {
  const trimmed = dateBlock.trim();
  return `\n      {mode === '${mode}' && (\n        <>\n${trimmed}\n        </>\n      )}\n`;
}

export function transformRecordDateLayout(source) {
  if (!source.includes('function RecordModal(')) return source;

  const dateStart = source.indexOf(EXACT_DATE_START);
  if (dateStart < 0) fail('Could not find the existing Exact date controls.');

  const expenseStart = source.indexOf(EXPENSE_BRANCH, dateStart);
  if (expenseStart < 0) fail('Could not find the Expense branch after the Exact date controls.');

  const dateBlock = source.slice(dateStart, expenseStart);
  if (!dateBlock.includes('Exact date not confirmed') || !dateBlock.includes('id="record-date"')) {
    fail('The extracted date block is incomplete.');
  }

  let output = source.slice(0, dateStart)
    + conditionalDateBlock('movement', dateBlock)
    + source.slice(expenseStart);

  const nextExpenseStart = output.indexOf(EXPENSE_BRANCH);
  const categoryStart = output.indexOf('<label htmlFor="record-category">Category</label>', nextExpenseStart);
  if (categoryStart < 0) fail('Could not find the Expense Category field.');
  const expenseInsert = output.indexOf('\n          <fieldset className="choice-group">', categoryStart);
  if (expenseInsert < 0) fail('Could not find the insertion point after Expense Category.');
  output = output.slice(0, expenseInsert)
    + conditionalDateBlock('expense', dateBlock)
    + output.slice(expenseInsert);

  const incomeStart = output.indexOf(INCOME_BRANCH);
  if (incomeStart < 0) fail('Could not find the Income branch.');
  const incomeTypeStart = output.indexOf('<label htmlFor="income-type">Income type</label>', incomeStart);
  if (incomeTypeStart < 0) fail('Could not find the Income type field.');
  const incomeInsert = output.indexOf('\n          <div className="form-grid">', incomeTypeStart);
  if (incomeInsert < 0) fail('Could not find the insertion point after Income type.');
  output = output.slice(0, incomeInsert)
    + conditionalDateBlock('income', dateBlock)
    + output.slice(incomeInsert);

  const recordModalStart = output.indexOf('function RecordModal(');
  const referenceSelectStart = output.indexOf('\nfunction ReferenceSelect(', recordModalStart);
  const recordModalSource = output.slice(recordModalStart, referenceSelectStart);

  const dateControlCount = (recordModalSource.match(/id="record-date"/g) || []).length;
  if (dateControlCount !== 3) fail(`Expected 3 mode-specific date controls, found ${dateControlCount}.`);
  if (!recordModalSource.includes("{mode === 'expense' && (\n        <>\n<div className=\"field\">\n        <label htmlFor=\"record-date\">Exact date</label>")) {
    fail('Expense Exact date controls were not inserted after Category.');
  }
  if (!recordModalSource.includes("{mode === 'income' && (\n        <>\n<div className=\"field\">\n        <label htmlFor=\"record-date\">Exact date</label>")) {
    fail('Income Exact date controls were not inserted after Income type.');
  }

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
