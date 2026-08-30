const EMPTY_COPY = new Map([
  ['No matching income.', 'No income recorded.'],
  ['No matching expenses.', 'No expenses recorded.'],
]);

function normaliseEmptyCopy(root = document) {
  root.querySelectorAll('.empty').forEach((node) => {
    const text = node.textContent?.trim() || '';
    if (EMPTY_COPY.has(text)) {
      node.textContent = EMPTY_COPY.get(text);
      return;
    }
    if (/^No savings snapshot has been recorded for\b/i.test(text)) {
      node.textContent = 'No savings recorded.';
    }
  });
}

function normaliseEmptySavings(root = document) {
  const savingsSection = root.querySelector('section[aria-labelledby="savings-accounts-title"]');
  if (!savingsSection) return;

  const heading = savingsSection.querySelector('#savings-accounts-title');
  const headingBlock = heading?.parentElement;
  const subtitle = headingBlock?.querySelector('.section-note');
  if (subtitle) subtitle.hidden = true;

  const empty = [...savingsSection.querySelectorAll('.empty')]
    .find((node) => /No savings (snapshot has been )?recorded/i.test(node.textContent || ''));
  const total = savingsSection.querySelector(':scope > .total-line');
  const goalSection = root.querySelector('section[aria-labelledby="savings-goal-title"]');

  if (empty) {
    empty.textContent = 'No savings recorded.';
    if (total) total.hidden = true;
    if (goalSection) goalSection.hidden = true;
  } else {
    if (total) total.hidden = false;
    if (goalSection) goalSection.hidden = false;
  }
}

function applyUniformEmptyStates() {
  normaliseEmptyCopy();
  normaliseEmptySavings();
}

export function installUniformEmptyStates() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyUniformEmptyStates();
    });
  };

  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}
