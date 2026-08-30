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

function recordDateInput() {
  const input = document.querySelector('.modal-inner #record-date');
  return input instanceof HTMLInputElement ? input : null;
}

function resetRecordModalToDate({ confirmUnknown = false, openPicker = false } = {}) {
  const dateInput = recordDateInput();
  if (!dateInput) return false;

  const modal = dateInput.closest('.modal-inner');
  if (modal) {
    modal.scrollTop = 0;
    modal.scrollTo?.({ top: 0, behavior: 'auto' });
  }

  if (confirmUnknown && dateInput.disabled) {
    const unknownToggle = [...document.querySelectorAll('.modal-inner .evidence-toggle input[type="checkbox"]')]
      .find((input) => input instanceof HTMLInputElement && input.checked);
    if (unknownToggle instanceof HTMLInputElement) unknownToggle.click();
  }

  dateInput.scrollIntoView({ block: 'start', behavior: 'auto' });
  if (modal) modal.scrollTop = 0;

  if (openPicker) {
    dateInput.focus({ preventScroll: true });
    if (typeof dateInput.showPicker === 'function' && !dateInput.disabled) {
      try { dateInput.showPicker(); } catch { /* iOS can require a direct user tap. */ }
    }
  }
  return true;
}

function stabiliseRecordModal(options = {}) {
  [0, 30, 90, 180, 320].forEach((delay) => {
    globalThis.setTimeout(() => resetRecordModalToDate(options), delay);
  });
}

function installRecordModalScrollGuard() {
  const observer = new MutationObserver(() => {
    if (!recordDateInput()) return;
    stabiliseRecordModal();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function installExactDateAction() {
  installRecordModalScrollGuard();

  document.addEventListener('click', (event) => {
    const badge = event.target instanceof Element ? event.target.closest('.status-pill.warning') : null;
    if (badge && isExactDateTbcBadge(badge)) {
      const editButton = findEditButton(badge);
      if (!editButton) return;
      event.preventDefault();
      editButton.click();
      stabiliseRecordModal({ confirmUnknown: true, openPicker: true });
      return;
    }

    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button?.textContent?.trim() === 'Edit' && button.closest('.record-row, .transaction-row, .record-item, li')) {
      stabiliseRecordModal();
    }
  }, true);
}
