function isExactDateTbcBadge(target) {
  return target instanceof Element
    && target.matches('.status-pill.warning')
    && /exact date/i.test(target.textContent || '');
}

function findEditButton(badge) {
  const record = badge.closest('.record-row, .transaction-row, .record-item, li');
  if (!record) return null;
  return [...record.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Edit') || null;
}

function revealDatePicker({ confirmUnknown = false } = {}) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const dateInput = document.querySelector('.modal-inner #record-date');
      if (!(dateInput instanceof HTMLInputElement)) return;

      const modal = dateInput.closest('.modal-inner');
      if (modal) modal.scrollTop = 0;

      if (confirmUnknown && dateInput.disabled) {
        const unknownToggle = [...document.querySelectorAll('.modal-inner .evidence-toggle input[type="checkbox"]')]
          .find((input) => input instanceof HTMLInputElement && input.checked);
        if (unknownToggle instanceof HTMLInputElement) unknownToggle.click();
      }

      dateInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
      dateInput.focus({ preventScroll: true });
      if (typeof dateInput.showPicker === 'function' && !dateInput.disabled) {
        try { dateInput.showPicker(); } catch { /* iOS may require another tap; field remains focused and visible. */ }
      }
    });
  });
}

export function installExactDateAction() {
  document.addEventListener('click', (event) => {
    const badge = event.target instanceof Element ? event.target.closest('.status-pill.warning') : null;
    if (badge && isExactDateTbcBadge(badge)) {
      const editButton = findEditButton(badge);
      if (!editButton) return;
      event.preventDefault();
      editButton.click();
      revealDatePicker({ confirmUnknown: true });
      return;
    }

    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button?.textContent?.trim() === 'Edit' && button.closest('.record-row, .transaction-row, .record-item, li')) {
      revealDatePicker();
    }
  });
}
