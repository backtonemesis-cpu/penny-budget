import { roundMoney } from './finance.js';

export function savingsGoalProgress(goal, currentSavings, monthlyContribution) {
  const target = Math.max(0, roundMoney(goal));
  const current = roundMoney(currentSavings);
  const monthly = Math.max(0, roundMoney(monthlyContribution));

  if (target <= 0) return { remaining: 0, months: null, reached: false };

  const remaining = Math.max(0, roundMoney(target - current));
  if (remaining === 0) return { remaining: 0, months: 0, reached: true };

  return {
    remaining,
    months: monthly > 0 ? Math.ceil(remaining / monthly) : null,
    reached: false,
  };
}
