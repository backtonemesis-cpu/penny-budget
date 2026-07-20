export const BASE_CATEGORIES = [
  { id: 'rent_mortgage', label: 'Rent / Mortgage', icon: '🏠', group: 'Housing', defaultClass: 'fixed' },
  { id: 'council_tax', label: 'Council Tax', icon: '🏛️', group: 'Housing', defaultClass: 'fixed' },
  { id: 'electricity', label: 'Electricity', icon: '⚡', group: 'Utilities', defaultClass: 'fixed' },
  { id: 'gas', label: 'Gas', icon: '🔥', group: 'Utilities', defaultClass: 'fixed' },
  { id: 'water', label: 'Water', icon: '💧', group: 'Utilities', defaultClass: 'fixed' },
  { id: 'internet', label: 'Broadband / Internet', icon: '🌐', group: 'Utilities', defaultClass: 'fixed' },
  { id: 'phones', label: 'Phones', icon: '📞', group: 'Bills', defaultClass: 'fixed' },
  { id: 'child_maintenance', label: 'Child Maintenance', icon: '👨‍👦', group: 'Family', defaultClass: 'fixed' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📱', group: 'Bills', defaultClass: 'fixed' },
  { id: 'bank_fees', label: 'Bank Fees', icon: '🏦', group: 'Bills', defaultClass: 'fixed' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', group: 'Bills', defaultClass: 'fixed' },
  { id: 'service_charge', label: 'Service Charge', icon: '🏢', group: 'Housing', defaultClass: 'fixed' },
  { id: 'ground_rent', label: 'Ground Rent', icon: '🏗️', group: 'Housing', defaultClass: 'fixed' },
  { id: 'variable_household', label: 'Variable Household', icon: '🛍️', group: 'Everyday', defaultClass: 'variable' },
  { id: 'groceries', label: 'Groceries', icon: '🛒', group: 'Everyday', defaultClass: 'variable' },
  { id: 'eating_out', label: 'Eating Out', icon: '🍽️', group: 'Everyday', defaultClass: 'variable' },
  { id: 'transport', label: 'Transport', icon: '🚆', group: 'Transport', defaultClass: 'variable' },
  { id: 'fuel', label: 'Fuel', icon: '⛽', group: 'Transport', defaultClass: 'variable' },
  { id: 'clothing', label: 'Clothing', icon: '👕', group: 'Shopping', defaultClass: 'variable' },
  { id: 'health', label: 'Health', icon: '❤️', group: 'Health', defaultClass: 'variable' },
  { id: 'holidays', label: 'Holidays / Travel', icon: '✈️', group: 'Other', defaultClass: 'variable' },
  { id: 'other', label: 'Other', icon: '📦', group: 'Other', defaultClass: 'variable' },
].map((category) => ({ ...category, fixed: true }));

export const MOVEMENT_TYPES = [
  { id: 'internal_transfer', label: 'Internal family transfer', icon: '↔️', impact: 'Visible for audit, excluded from expenses.' },
  { id: 'savings_transfer', label: 'Savings transfer', icon: '🏦', impact: 'Visible for audit, excluded from expenses.' },
  { id: 'card_repayment', label: 'Card repayment', icon: '💳', impact: 'Excluded when the underlying purchases are recorded.' },
];

export const SPECIAL_TRANSACTION_META = Object.fromEntries(
  MOVEMENT_TYPES.map((item) => [item.id, item]),
);

export const SPECIAL_PEOPLE = [
  { id: 'household', label: 'Household' },
  { id: 'unassigned', label: 'Unassigned' },
];

export const SPECIAL_ACCOUNTS = [
  { id: 'unassigned', label: 'Unassigned' },
];

export function makeCategoryMap(customCategories = []) {
  return Object.fromEntries([...BASE_CATEGORIES, ...customCategories].map((category) => [category.id, category]));
}

export function makeReferenceMap(items = [], specialItems = []) {
  return Object.fromEntries([...items, ...specialItems].map((item) => [item.id, item]));
}
