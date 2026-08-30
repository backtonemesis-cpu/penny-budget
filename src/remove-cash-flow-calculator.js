function removeCashFlowCalculator() {
  const headings = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main summary, main button, main [role="button"]')];
  const heading = headings.find((node) => node.textContent?.trim().toLowerCase() === 'cash-flow calculation');
  if (!heading) return;

  const calculator = heading.closest('details, section, article, .card, .panel, .overview-section') || heading.parentElement;
  if (calculator) calculator.remove();
}

export function installCashFlowCalculatorRemoval() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      removeCashFlowCalculator();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();
}
