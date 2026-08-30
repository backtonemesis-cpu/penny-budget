from pathlib import Path

path = Path('src/overview-status.js')
text = path.read_text()
old = """export function overviewActionableIncompleteCount(summary) {
  if (!summary) return 0;
  if (summary.isComplete) return summary.incompleteRecords || 0;
  const expenses = (summary.expenseTransactions || []).filter((record) => record.needsConfirmation && !isRoutineCopiedPlanningRecord(record)).length;
  const income = (summary.incomeRecords || []).filter((record) => record.needsConfirmation && !isRoutineCopiedPlanningRecord(record)).length;
  const movements = (summary.transactions || []).filter((record) => record.type !== 'expense' && record.needsConfirmation && !isRoutineCopiedPlanningRecord(record)).length;
  return expenses + income + movements;
}
"""
new = """export function overviewActionableIncompleteCount(summary) {
  if (!summary) return 0;
  if (summary.isComplete) return summary.incompleteRecords || 0;
  const transactionRecords = summary.expenseTransactions || summary.transactions || [];
  const actionable = (record) => Boolean(record?.needsConfirmation || record?.confirmationIssues?.length) && !isRoutineCopiedPlanningRecord(record);
  const transactions = transactionRecords.filter(actionable).length;
  const income = (summary.incomeRecords || []).filter(actionable).length;
  return transactions + income;
}
"""
if old not in text:
    raise SystemExit('Overview filter target not found')
path.write_text(text.replace(old, new, 1))
print('Fixed Overview evidence filter')
