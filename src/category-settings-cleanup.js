let cleanupInstalled = false;
let cleanupScheduled = false;

function settingsModal() {
  return document.querySelector('.wide-modal');
}

function sectionByHeading(modal, label) {
  const heading = [...modal.querySelectorAll('.settings-section > h3')].find((item) => item.textContent?.trim() === label);
  return heading?.closest('.settings-section') || null;
}

function hideVisibleChangeHistory(modal) {
  const section = sectionByHeading(modal, 'Change History');
  if (section && !section.hidden) section.hidden = true;
}

function setGlobalSetupNote(section, text) {
  if (!section) return;
  let note = section.querySelector('[data-global-setup-note]');
  if (!note) {
    note = document.createElement('p');
    note.className = 'section-note global-setup-note';
    note.setAttribute('data-global-setup-note', '');
    const heading = section.querySelector(':scope > h3');
    heading?.insertAdjacentElement('afterend', note);
  }
  if (note.textContent !== text) note.textContent = text;
}

function accountOwnerCounts(modal) {
  const counts = new Map();
  const section = sectionByHeading(modal, 'Accounts');
  section?.querySelectorAll('.account-settings-row select').forEach((select) => {
    const label = select.selectedOptions?.[0]?.textContent?.trim();
    if (!label || label === 'TBC' || label === 'Joint') return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return counts;
}

function explainHouseholdDependencies(modal) {
  const section = sectionByHeading(modal, 'Household People');
  if (!section) return;
  const ownerCounts = accountOwnerCounts(modal);

  section.querySelectorAll('.settings-row').forEach((row) => {
    if (row.querySelector('.primary-button')) return;
    const input = row.querySelector('input');
    const blockedButton = row.querySelector('.danger-button:disabled');
    row.querySelector('[data-reference-use-note]')?.remove();
    if (!input || !blockedButton) return;

    const name = input.value.trim();
    const ownedAccounts = ownerCounts.get(name) || 0;
    const note = document.createElement('div');
    note.className = 'reference-use-note';
    note.setAttribute('data-reference-use-note', '');
    note.textContent = ownedAccounts
      ? `Cannot remove: owner of ${ownedAccounts} account${ownedAccounts === 1 ? '' : 's'}. Reassign ${ownedAccounts === 1 ? 'it' : 'them'} first.`
      : 'Cannot remove: referenced by saved financial records.';
    row.appendChild(note);
  });
}

function clarifyGlobalSettings(modal) {
  setGlobalSetupNote(
    sectionByHeading(modal, 'Household People'),
    'Global setup — kept when you clear a month. A person can be removed only after they no longer own an account and are not referenced by saved financial records.',
  );
  setGlobalSetupNote(
    sectionByHeading(modal, 'Accounts'),
    'Global setup — kept when you clear a month. Removing an account removes it from future choices; historical records keep their saved account evidence.',
  );
  const categorySection = [...modal.querySelectorAll('.settings-section')].find((section) => section.querySelector(':scope > h3')?.textContent?.trim() === 'Categories');
  setGlobalSetupNote(
    categorySection,
    'Global setup — kept when you clear a month. Hide built-in categories you do not want to use; unused custom categories can be deleted.',
  );
  explainHouseholdDependencies(modal);
}

function syncIconSelect(fieldset) {
  const grid = fieldset.querySelector('.icon-grid');
  if (!grid) return;
  const buttons = [...grid.querySelectorAll('button.icon-choice')];
  if (!buttons.length) return;

  let wrapper = fieldset.querySelector('.category-icon-select');
  let select = wrapper?.querySelector('select');
  if (!wrapper || !select) {
    wrapper = document.createElement('div');
    wrapper.className = 'category-icon-select';
    select = document.createElement('select');
    select.setAttribute('aria-label', 'Category icon');
    buttons.forEach((button) => {
      const option = document.createElement('option');
      option.value = button.textContent?.trim() || '🏷️';
      option.textContent = option.value;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      const target = buttons.find((button) => button.textContent?.trim() === select.value);
      target?.click();
    });
    wrapper.appendChild(select);
    fieldset.insertBefore(wrapper, grid);
  }

  const selected = buttons.find((button) => button.getAttribute('aria-pressed') === 'true') || buttons[0];
  const nextValue = selected?.textContent?.trim() || '🏷️';
  if (select.value !== nextValue) select.value = nextValue;
  if (!grid.hidden) grid.hidden = true;
}

function enhanceCategorySettings() {
  const modal = settingsModal();
  if (!modal) return;
  hideVisibleChangeHistory(modal);
  clarifyGlobalSettings(modal);
  modal.querySelectorAll('fieldset.icon-picker').forEach(syncIconSelect);
}

function scheduleEnhancement() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  requestAnimationFrame(() => {
    cleanupScheduled = false;
    enhanceCategorySettings();
  });
}

function confirmCategoryDelete(event) {
  const button = event.target.closest?.('.category-settings-row .danger-button');
  if (!button || button.disabled || button.textContent?.trim() !== 'Delete') return;
  const row = button.closest('.category-settings-row');
  const label = row?.querySelector('.grow > div')?.textContent?.trim() || 'this category';
  if (globalThis.confirm(`Delete “${label}”? This only removes an unused custom category. Historical or in-use categories cannot be deleted.`)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

export function installCategorySettingsCleanup() {
  if (cleanupInstalled) return;
  cleanupInstalled = true;
  document.addEventListener('click', confirmCategoryDelete, true);
  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleEnhancement();
}
