function hasActionableConfirmationIssue(record) {
  const issues = Array.isArray(record?.confirmationIssues) ? record.confirmationIssues : [];
  if (!issues.length) return false;
  if (record?.source === 'month_copy' && issues.every((issue) => issue === 'date')) return false;
  return true;
}

export function overviewActionableIncompleteCount(summary) {
  if (!summary) return 0;
  if (summary.isComplete) return Number(summary.incompleteRecords || 0);
  const records = [
    ...(Array.isArray(summary.transactions) ? summary.transactions : []),
    ...(Array.isArray(summary.incomeRecords) ? summary.incomeRecords : []),
  ];
  return records.filter(hasActionableConfirmationIssue).length;
}
