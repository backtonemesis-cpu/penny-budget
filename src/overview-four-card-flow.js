function overviewIsActive() {
  return [...document.querySelectorAll('.nav button')].some((button) => button.textContent?.trim() === 'Overview' && button.classList.contains('active'));
}

function setText(root, selector, text) {
  const node = root?.querySelector(selector);
  if (node && node.textContent !== text) node.textContent = text;
}

function applyOverviewFourCardFlow() {
  if (!overviewIsActive()) return;

  const heroGrid = document.querySelector('main .hero-grid');
  const metricGrid = document.querySelector('main .metric-grid');
  if (!heroGrid || !metricGrid) return;

  const heroCards = [...heroGrid.querySelectorAll(':scope > .stat')];
  const metricCards = [...metricGrid.querySelectorAll(':scope > .stat')];
  if (heroCards.length < 2 || metricCards.length < 3) return;

  const monthInput = document.querySelector('.month-input');
  const [year, monthNumber] = (monthInput?.value || '').split('-').map(Number);
  const monthName = Number.isInteger(monthNumber)
    ? new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2000, monthNumber - 1, 1))
    : '';
  const monthLabel = monthName && year ? `${monthName} ${year}` : 'This month';

  setText(metricCards[0], '.label', 'INCOME');
  setText(metricCards[0], '.sub', monthLabel);
  setText(metricCards[1], '.label', 'EXPENSES');
  setText(metricCards[1], '.sub', monthLabel);
  setText(metricCards[2], '.label', `${monthName ? monthName.toUpperCase() + ' ' : ''}SAVINGS`);
  setText(metricCards[2], '.sub', 'Income minus expenses');

  let totalCard = metricGrid.querySelector('.overview-total-savings');
  if (!totalCard) {
    totalCard = heroCards[1].cloneNode(true);
    totalCard.classList.remove('stat-hero');
    totalCard.classList.add('stat-compact', 'overview-total-savings');
    metricGrid.appendChild(totalCard);
  }

  const projectedValue = heroCards[1].querySelector('.value')?.textContent || '£0.00';
  setText(totalCard, '.label', 'TOTAL SAVINGS');
  setText(totalCard, '.value', projectedValue);
  setText(totalCard, '.sub', monthName && year ? `End of ${monthName} ${year}` : 'End of month');

  heroGrid.classList.add('overview-legacy-savings-hidden');
  metricGrid.classList.add('overview-four-card-grid');
}

export function installOverviewFourCardFlow() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyOverviewFourCardFlow();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener('change', schedule);
  schedule();
}
