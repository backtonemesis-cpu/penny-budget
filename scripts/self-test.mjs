import assert from "node:assert/strict";
import { annualSummary, dueStatus, formatMoney, migrateState, mkKey, monthSummary } from "../src/finance.js";

const now = new Date(2026, 6, 19);
const migrated = migrateState({
  sources: [{ id: "salary", label: "Salary", amount: 3000 }],
  txnsByMonth: { "2026-06": [{ id: 1, type: "expense", amount: 100, date: "2026-06-01", category: "rent" }] },
}, now);
assert.equal(migrated.incomeByMonth["2026-06"][0].amount, 3000);
assert.equal(migrated.incomeByMonth["2026-07"][0].amount, 3000);

const state = {
  ...migrated,
  incomeByMonth: {
    "2026-06": [{ id: "a", amount: 3000 }],
    "2026-07": [{ id: "b", amount: 3200 }],
  },
  txnsByMonth: {
    "2026-06": [{ id: "x", type: "expense", amount: 1000 }],
    "2026-07": [{ id: "y", type: "expense", amount: 1200 }, { id: "z", type: "refund", amount: 50 }],
  },
};
assert.deepEqual(monthSummary(state, "2026-07"), {
  incomeSources: state.incomeByMonth["2026-07"],
  transactions: state.txnsByMonth["2026-07"],
  income: 3200,
  expenses: 1200,
  refunds: 50,
  available: 2050,
  hasData: true,
});
const annual = annualSummary(state, 2026);
assert.equal(annual.income, 6200);
assert.equal(annual.expenses, 2200);
assert.equal(annual.refunds, 50);
assert.equal(annual.available, 4050);
assert.equal(formatMoney(-500), "-£500.00");
assert.equal(formatMoney(50, { plus: true }), "+£50.00");
assert.equal(dueStatus(2026, 5, 10, false, now).label, "overdue");
assert.equal(mkKey(2026, 0), "2026-01");
console.log("Penny finance self-tests passed");
