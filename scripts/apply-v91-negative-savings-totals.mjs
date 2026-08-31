import { readFile, writeFile } from 'node:fs/promises';

function replaceRequired(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error('v91 missing anchor: ' + label);
  return text.replace(before, after);
}

let finance = await readFile('src/finance.js', 'utf8');
finance = replaceRequired(
  finance,
  "  return sumMoney((state?.savingsByMonth?.[monthKey] || []).map((account) => nonNegativeNumber(account.balance)));",
  "  return sumMoney((state?.savingsByMonth?.[monthKey] || []).map((account) => signedNumber(account.balance))); // PENNY_V91_SIGNED_SAVINGS_TOTAL",
  'signed current savings total',
);
finance = replaceRequired(
  finance,
  "      currentBalance: bankBalance ? nonNegativeNumber(bankBalance.balance) : 0,",
  "      currentBalance: bankBalance ? signedNumber(bankBalance.balance) : 0, // PENNY_V91_SIGNED_BANK_BALANCE",
  'signed Transfer Plan current balance',
);
await writeFile('src/finance.js', finance);

let app = await readFile('src/App.jsx', 'utf8');
app = replaceRequired(
  app,
  '!editing && <div className="money green">{formatMoney(account.balance)}</div>',
  '!editing && <div className={`money ${account.balance < 0 ? \'red\' : \'green\'}`}>{formatMoney(account.balance)}</div>',
  'savings account signed colour',
);
app = replaceRequired(
  app,
  '<span className="money green">{formatMoney(summary.currentSavings)}</span>',
  '<span className={`money ${summary.currentSavings < 0 ? \'red\' : \'green\'}`}>{formatMoney(summary.currentSavings)}</span>',
  'savings snapshot signed colour',
);
await writeFile('src/App.jsx', app);

console.log('PENNY_V91 negative savings totals and colours applied');
