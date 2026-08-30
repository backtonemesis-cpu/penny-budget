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

export function installExactDateAction() {
  document.addEventListener('click', (event) => {
    const badge = event.target instanceof Element ? event.target.closest('.status-pill.warning') : null;
    if (!badge || !isExactDateTbcBadge(badge)) return;
    const editButton = findEditButton(badge);
    if (!editButton) return;
    event.preventDefault();
    editButton.click();
  });
}
