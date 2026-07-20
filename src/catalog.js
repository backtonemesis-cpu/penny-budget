export const BASE_CATEGORIES = [
  { id: 'rent', label: 'Rent / Mortgage', icon: '🏠', group: 'Housing', bill: true, budgetable: true },
  { id: 'council_tax', label: 'Council Tax', icon: '🏛️', group: 'Bills', bill: true, budgetable: true },
  { id: 'electricity', label: 'Electricity', icon: '⚡', group: 'Bills', bill: true, budgetable: true },
  { id: 'gas', label: 'Gas', icon: '🔥', group: 'Bills', bill: true, budgetable: true },
  { id: 'water', label: 'Water', icon: '💧', group: 'Bills', bill: true, budgetable: true },
  { id: 'internet', label: 'Broadband / Internet', icon: '🌐', group: 'Bills', bill: true, budgetable: true },
  { id: 'phone_bill', label: 'Phone', icon: '📞', group: 'Bills', bill: true, budgetable: true },
  { id: 'child_maintenance', label: 'Child Maintenance', icon: '👨‍👦', group: 'Bills', bill: true, budgetable: true },
  { id: 'service_charge', label: 'Service Charge', icon: '🏢', group: 'Bills', bill: true, budgetable: true },
  { id: 'ground_rent', label: 'Ground Rent', icon: '🏗️', group: 'Bills', bill: true, budgetable: true },
  { id: 'tv_licence', label: 'TV Licence', icon: '📺', group: 'Bills', bill: true, budgetable: true },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', group: 'Bills', bill: true, budgetable: true },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📱', group: 'Bills', bill: true, budgetable: true },
  { id: 'bank_fees', label: 'Bank Fees', icon: '🏦', group: 'Bills', bill: true, budgetable: true },
  { id: 'groceries', label: 'Groceries', icon: '🛒', group: 'Everyday', bill: false, budgetable: true },
  { id: 'coffee_shop', label: 'Coffee Shop', icon: '☕', group: 'Eating Out', bill: false, budgetable: true },
  { id: 'eating_out', label: 'Restaurants / Pubs', icon: '🍽️', group: 'Eating Out', bill: false, budgetable: true },
  { id: 'takeaway', label: 'Takeaway', icon: '🥡', group: 'Eating Out', bill: false, budgetable: true },
  { id: 'fuel', label: 'Fuel', icon: '⛽', group: 'Transport', bill: false, budgetable: true },
  { id: 'transport', label: 'Transport', icon: '🚆', group: 'Transport', bill: false, budgetable: true },
  { id: 'clothing', label: 'Clothing', icon: '👕', group: 'Shopping', bill: false, budgetable: true },
  { id: 'gifts', label: 'Gifts', icon: '🎁', group: 'Shopping', bill: false, budgetable: true },
  { id: 'health', label: 'Health', icon: '❤️', group: 'Health', bill: false, budgetable: true },
  { id: 'holidays', label: 'Holidays / Travel', icon: '✈️', group: 'Other', bill: false, budgetable: true },
  { id: 'other', label: 'Other', icon: '📦', group: 'Other', bill: false, budgetable: true },
].map((category) => ({ ...category, fixed: true }));

export const TRANSACTION_TREATMENTS = [
  { id: 'expense', label: 'Expense', impact: 'Counts as spending' },
  { id: 'refund', label: 'Refund / credit', impact: 'Adds money back' },
  { id: 'internal_transfer', label: 'Internal family transfer', impact: 'Visible, excluded from totals' },
  { id: 'savings_transfer', label: 'Savings transfer', impact: 'Visible, excluded from spending' },
  { id: 'card_repayment', label: 'Card repayment', impact: 'Visible, excluded when purchases are logged' },
];

export const SPECIAL_TRANSACTION_META = {
  internal_transfer: { label: 'Internal family transfer', icon: '↔️' },
  savings_transfer: { label: 'Savings transfer', icon: '🏦' },
  card_repayment: { label: 'Card repayment', icon: '💳' },
};

const FIXED_BILL_IDS = new Set(BASE_CATEGORIES.filter((category) => category.bill).map((category) => category.id));

export function isFixedBillCategory(categoryId) {
  return FIXED_BILL_IDS.has(categoryId);
}

export function makeCategoryMap(customCategories = []) {
  return Object.fromEntries([...BASE_CATEGORIES, ...customCategories].map((category) => [category.id, category]));
}
