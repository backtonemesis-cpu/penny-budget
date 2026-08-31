import assert from 'node:assert/strict';
import { savingsGoalProgress } from '../src/savings-goal.js';

assert.deepEqual(
  savingsGoalProgress(1714.02, 0, 500),
  { remaining: 1714.02, months: 4, reached: false },
  '£1,714.02 at £500/month must take 4 months',
);
assert.deepEqual(
  savingsGoalProgress(1714, 0, 1000),
  { remaining: 1714, months: 2, reached: false },
  '£1,714 at £1,000/month must take 2 months',
);
assert.deepEqual(
  savingsGoalProgress(2000, 750, 500),
  { remaining: 1250, months: 3, reached: false },
  'existing savings must reduce the amount remaining',
);
assert.deepEqual(
  savingsGoalProgress(2000, -500, 500),
  { remaining: 2500, months: 5, reached: false },
  'a negative savings position must increase the amount remaining',
);
assert.deepEqual(
  savingsGoalProgress(1000, 1000, 250),
  { remaining: 0, months: 0, reached: true },
  'a reached goal must report no remaining months',
);
assert.deepEqual(
  savingsGoalProgress(1000, 250, 0),
  { remaining: 750, months: null, reached: false },
  'a goal with no monthly contribution must not invent a forecast',
);

console.log('v99 savings goal calculation regression passed');
