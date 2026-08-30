let cleanupInstalled = false;
let cleanupScheduled = false;

function settingsModal() {
  return document.querySelector('.wide-modal');
}

function hideVisibleChangeHistory(modal) {
  const heading = [...modal.querySelectorAll('.settings-section > h3')].find((item) => item.textContent?.trim() === 'Change History');
  const section = heading?.closest('.settings-section');
  if (section && !section.hidden) section.hidden = true;
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
