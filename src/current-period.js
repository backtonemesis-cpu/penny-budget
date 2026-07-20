export function currentLocalPeriod(date = new Date()) {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
  };
}

export function currentPeriodCheckDelay(date = new Date(), maximumDelay = 60 * 60 * 1000) {
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 1, 0);
  const untilNextMonth = Math.max(1000, nextMonth.getTime() - date.getTime());
  return Math.min(untilNextMonth, maximumDelay);
}
