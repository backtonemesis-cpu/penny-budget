const ATTENTION_SELECTOR = '.compact-overview-warning';

function findTransactionsButton() {
  return [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Transactions') || null;
}

function focusFirstIncompleteRecord() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const warningBadge = document.querySelector('.record-row .status-pill.warning');
      const row = warningBadge?.closest('.record-row');
      if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const editButton = [...row.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Edit');
      if (editButton) editButton.focus({ preventScroll: true });
    });
  });
}

function openMissingEvidence() {
  const transactionsButton = findTransactionsButton();
  if (!transactionsButton) return;
  transactionsButton.click();
  focusFirstIncompleteRecord();
}

function enhanceAttentionCard(card) {
  if (card.dataset.pennyAttentionAction === 'true') return;
  card.dataset.pennyAttentionAction = 'true';
  card.classList.add('actionable-attention-card');
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `${card.querySelector('strong')?.textContent || 'Items need attention'}. Open Transactions and review the first record with missing evidence.`);

  card.addEventListener('click', openMissingEvidence);
  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openMissingEvidence();
  });

  const hint = card.querySelector('span');
  if (hint) hint.textContent = 'Tap to review the missing evidence.';
}

function enhanceAllAttentionCards() {
  document.querySelectorAll(ATTENTION_SELECTOR).forEach(enhanceAttentionCard);
}

export function installAttentionNavigation() {
  enhanceAllAttentionCards();
  const observer = new MutationObserver(enhanceAllAttentionCards);
  observer.observe(document.body, { childList: true, subtree: true });
}
