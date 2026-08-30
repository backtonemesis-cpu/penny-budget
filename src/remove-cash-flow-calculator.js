const CASH_FLOW_LABEL = 'cash-flow calculation';

function removeCashFlowCalculator() {
  const overviewActive = [...document.querySelectorAll('.nav button')]
    .some((button) => button.textContent?.trim() === 'Overview' && button.classList.contains('active'));
  if (!overviewActive) return;

  const headings = [...document.querySelectorAll('main summary, main h1, main h2, main h3, main h4')];
  const heading = headings.find((node) => node.textContent?.trim().toLowerCase() === CASH_FLOW_LABEL);
  if (!heading) return;

  const calculator = heading.closest('details');
  if (calculator) calculator.remove();
}

export function installCashFlowCalculatorRemoval() {
  const observer = new MutationObserver(() => removeCashFlowCalculator());
  observer.observe(document.body, { childList: true, subtree: true });
  removeCashFlowCalculator();
}
