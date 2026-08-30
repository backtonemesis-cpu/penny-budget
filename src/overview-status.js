function isRoutineCopiedPlanningRecord(record) {
  if (record?.source !== 'month_copy') return false;
  const issues = record.confirmationIssues || [];
  if (record.type === 'expense') return issues.every((issue) => issue === 'date');
  return issues.every((issue) => ['date','amount','received'].includes(issue));
}

export function overviewActionableIncompleteCount(summary) {
  if (!summary) return 0;
  if (summary.isComplete) return summary.incompleteRecords || 0;
  const transactionRecords = summary.expenseTransactions || summary.transactions || [];
  const actionable = (record) => Boolean(record?.needsConfirmation || record?.confirmationIssues?.length) && !isRoutineCopiedPlanningRecord(record);
  const transactions = transactionRecords.filter(actionable).length;
  const income = (summary.incomeRecords || []).filter(actionable).length;
  return transactions + income;
}
