import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../src/App.jsx', import.meta.url);
const stylesPath = new URL('../src/styles.css', import.meta.url);
const auditPath = new URL('./source-audit.mjs', import.meta.url);

function replaceOnce(source, search, replacement, label) {
  const matches = typeof search === 'string'
    ? source.split(search).length - 1
    : [...source.matchAll(new RegExp(search.source, `${search.flags.includes('g') ? search.flags : `${search.flags}g`}`))].length;
  if (matches !== 1) throw new Error(`${label}: expected 1 match, found ${matches}`);
  return source.replace(search, replacement);
}

let app = await readFile(appPath, 'utf8');

app = replaceOnce(
  app,
  `          <Transactions
            transactions={summary.transactions}
            categoryMap={categoryMap}
            onManageCategories={() => setModal('categories')}
            onDelete={deleteTransaction}
          />`,
  `          <Transactions
            transactions={summary.transactions}
            categoryMap={categoryMap}
            onDelete={deleteTransaction}
          />`,
  'Remove category management from Activity',
);

app = replaceOnce(
  app,
  `        <TransactionModal
          monthKey={monthKey}
          categories={visibleCategories}
          onClose={() => setModal(null)}
          onSave={addTransaction}
        />`,
  `        <TransactionModal
          monthKey={monthKey}
          categories={visibleCategories}
          allCategories={allCategories}
          state={state}
          mutate={mutate}
          onClose={() => setModal(null)}
          onSave={addTransaction}
        />`,
  'Pass category controls into Add transaction',
);

app = replaceOnce(
  app,
  `
      {modal === 'categories' && (
        <CategoryModal
          categories={allCategories}
          state={state}
          mutate={mutate}
          onClose={() => setModal(null)}
        />
      )}`,
  '',
  'Remove standalone category modal',
);

app = replaceOnce(
  app,
  `function Transactions({ transactions, categoryMap, onManageCategories, onDelete })`,
  `function Transactions({ transactions, categoryMap, onDelete })`,
  'Simplify Activity props',
);

app = replaceOnce(
  app,
  `          <button className="secondary-button" onClick={onManageCategories}>Categories</button>`,
  '',
  'Remove Categories button from Activity',
);

app = replaceOnce(
  app,
  `function TransactionModal({ monthKey, categories, onClose, onSave })`,
  `function TransactionModal({ monthKey, categories, allCategories, state, mutate, onClose, onSave })`,
  'Add category-manager props to transaction modal',
);

app = replaceOnce(
  app,
  `  const [category, setCategory] = useState('');
  const [date, setDate] = useState(monthKey === currentMonthKey ? localDateKey() : \`${'${monthKey}'}-01\`);`,
  `  const [category, setCategory] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [date, setDate] = useState(monthKey === currentMonthKey ? localDateKey() : \`${'${monthKey}'}-01\`);`,
  'Add category-manager visibility state',
);

app = replaceOnce(
  app,
  `      {needsCategory && (
        <div className="field">
          <label htmlFor="transaction-category">Category</label>
          <select id="transaction-category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Select category</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}</option>)}
          </select>
        </div>
      )}`,
  `      {needsCategory && (
        <>
          <div className="field">
            <label htmlFor="transaction-category">Category</label>
            <select id="transaction-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Select category</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}</option>)}
            </select>
          </div>
          <button
            type="button"
            className="secondary-button category-manager-toggle"
            aria-expanded={showCategoryManager}
            onClick={() => setShowCategoryManager((open) => !open)}
          >
            {showCategoryManager ? 'Close category settings' : '+ Add or manage categories'}
          </button>
          {showCategoryManager && (
            <CategoryManager
              categories={allCategories}
              state={state}
              mutate={mutate}
              onCategoryCreated={(categoryId) => {
                setCategory(categoryId);
                setShowCategoryManager(false);
              }}
            />
          )}
        </>
      )}`,
  'Move category management into Add transaction',
);

const categoryManager = `const CATEGORY_ICON_OPTIONS = ['🏷️', '🛒', '🍽️', '🚗', '🏠', '💡', '📱', '🎁', '❤️', '✈️', '👶', '🐾', '🎓', '🧾', '💳'];

function CategoryManager({ categories, state, mutate, onCategoryCreated }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [categoryType, setCategoryType] = useState('spending');

  const addCategory = () => {
    const label = name.trim();
    if (!label) return;
    const id = createId('category');
    const bill = categoryType === 'fixed';
    mutate({
      type: 'ADD_CAT',
      cat: {
        id,
        label: label.slice(0, 80),
        icon,
        group: bill ? 'Bills' : 'Other',
        bill,
        budgetable: true,
        fixed: false,
      },
    });
    setName('');
    setIcon('🏷️');
    setCategoryType('spending');
    onCategoryCreated?.(id);
  };

  return (
    <section className="category-manager-panel" aria-labelledby="category-manager-title">
      <h3 id="category-manager-title">Category settings</h3>
      <p className="rule-note">New categories default to everyday spending. Choose fixed monthly bill only for a regular committed cost that belongs in Bills.</p>

      <div className="field">
        <label htmlFor="new-category-name">Category name</label>
        <input id="new-category-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="For example: Childcare" />
      </div>

      <fieldset className="category-type-picker">
        <legend>Category type</legend>
        <label className={categoryType === 'spending' ? 'category-type-option selected' : 'category-type-option'}>
          <input type="radio" name="category-type" value="spending" checked={categoryType === 'spending'} onChange={() => setCategoryType('spending')} />
          <span><strong>Everyday spending</strong><small>Counts as normal gross spending.</small></span>
        </label>
        <label className={categoryType === 'fixed' ? 'category-type-option selected' : 'category-type-option'}>
          <input type="radio" name="category-type" value="fixed" checked={categoryType === 'fixed'} onChange={() => setCategoryType('fixed')} />
          <span><strong>Fixed monthly bill</strong><small>Appears in Bills and can have a due date.</small></span>
        </label>
      </fieldset>

      <fieldset className="icon-picker">
        <legend>Choose an icon</legend>
        <div className="icon-grid">
          {CATEGORY_ICON_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={icon === option ? 'icon-choice selected' : 'icon-choice'}
              aria-label={\`Use ${'${option}'} icon\`}
              aria-pressed={icon === option}
              onClick={() => setIcon(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className="primary-button" style={{ width: '100%' }} disabled={!name.trim()} onClick={addCategory}>Add category</button>

      <details className="category-list">
        <summary>Manage existing categories</summary>
        <div className="category-list-body">
          {categories.map((category) => {
            const custom = !category.fixed;
            const inUse = categoryInUse(state, category.id);
            return (
              <div className="row" key={category.id}>
                <span aria-hidden="true">{category.icon}</span>
                <div className="grow">
                  <div>{category.label}</div>
                  <div className="muted">{category.bill ? 'Fixed monthly bill' : 'Everyday spending'}</div>
                </div>
                <button type="button" className="secondary-button" onClick={() => mutate({ type: 'TOGGLE_HIDE', id: category.id })}>{state.hiddenCats.includes(category.id) ? 'Show' : 'Hide'}</button>
                {custom && (
                  <button
                    type="button"
                    className="danger-button"
                    disabled={inUse}
                    title={inUse ? 'This category is used by transactions' : 'Delete category'}
                    onClick={() => !inUse && mutate({ type: 'REMOVE_CAT', id: category.id })}
                  >
                    {inUse ? 'In use' : 'Delete'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}`;

app = replaceOnce(
  app,
  /function CategoryModal\([\s\S]*?\n}\n\nfunction SimpleModal/,
  `${categoryManager}\n\nfunction SimpleModal`,
  'Replace misleading category modal with category manager',
);

await writeFile(appPath, app);

let styles = await readFile(stylesPath, 'utf8');
if (styles.includes('.category-manager-panel')) throw new Error('Category manager styles already exist.');
styles += `

.category-manager-toggle {
  width: 100%;
  margin: -2px 0 12px;
}

.category-manager-panel {
  margin: 0 0 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  background: rgba(28, 34, 51, 0.55);
}

.category-manager-panel h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.category-type-picker,
.icon-picker {
  margin: 0 0 14px;
  border: 0;
  padding: 0;
}

.category-type-picker legend,
.icon-picker legend {
  margin-bottom: 7px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.category-type-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.category-type-option {
  display: flex;
  min-height: 78px;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 11px;
  padding: 10px;
  background: var(--surface);
  cursor: pointer;
}

.category-type-option.selected {
  border-color: var(--accent);
  background: rgba(96, 165, 250, 0.1);
}

.category-type-option input {
  flex: 0 0 auto;
  margin-top: 3px;
}

.category-type-option span {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-type-option strong {
  font-size: 13px;
  line-height: 1.2;
}

.category-type-option small {
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.35;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}

.icon-choice {
  display: grid;
  min-height: 44px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 4px;
  background: var(--surface);
  font-size: 21px;
}

.icon-choice.selected {
  border-color: var(--accent);
  background: rgba(96, 165, 250, 0.13);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.category-list {
  margin-top: 14px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.category-list summary {
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.category-list-body {
  margin-top: 8px;
}

@media (max-width: 420px) {
  .category-type-picker {
    grid-template-columns: 1fr;
  }
}
`;
await writeFile(stylesPath, styles);

let audit = await readFile(auditPath, 'utf8');
audit = replaceOnce(
  audit,
  `  assert.match(files.catalog, /card_repayment/);`,
  `  assert.match(files.catalog, /card_repayment/);
  assert.doesNotMatch(files.app, /onManageCategories|Treat this as a fixed monthly bill/, 'Category management must not live in Activity or use the old checkbox wording.');
  assert.match(files.app, /Everyday spending/);
  assert.match(files.app, /Fixed monthly bill/);
  assert.match(files.app, /icon-choice/);`,
  'Add category UX regression audit',
);
await writeFile(auditPath, audit);

console.log('Category UX fix applied successfully.');
