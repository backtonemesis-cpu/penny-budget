export const MAX_SAFE_MONEY_PENCE = BigInt(Number.MAX_SAFE_INTEGER);
export const MAX_SAFE_MONEY_DISPLAY = '£90,071,992,547,409.91';

export function validateMoneyInput(value, { allowZero = false, allowNegative = false } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return { ok: false, code: 'required' };

  const negative = text.startsWith('-');
  if (negative && !allowNegative) return { ok: false, code: 'negative' };
  const unsignedText = negative ? text.slice(1) : text;

  const match = /^(\d+)(?:\.(\d+))?$/.exec(unsignedText);
  if (!match) return { ok: false, code: 'invalid' };

  const decimals = match[2] || '';
  if (decimals.length > 2) return { ok: false, code: 'precision' };

  const whole = match[1].replace(/^0+(?=\d)/, '') || '0';
  // Avoid constructing enormous BigInts from accidental/pasted garbage.
  if (whole.length > 16) return { ok: false, code: 'unsafe' };

  try {
    const absolutePence = (BigInt(whole) * 100n) + BigInt((decimals + '00').slice(0, 2));
    if (absolutePence > MAX_SAFE_MONEY_PENCE) return { ok: false, code: 'unsafe' };
    if (!allowZero && absolutePence === 0n) return { ok: false, code: 'zero' };
    const pence = negative ? -absolutePence : absolutePence;
    return { ok: true, code: 'ok', pence, value: Number(pence) / 100 };
  } catch {
    return { ok: false, code: 'invalid' };
  }
}

export function moneyValidationMessage(result, label = 'Amount') {
  switch (result?.code) {
    case 'required': return `${label} is required.`;
    case 'negative': return `${label} cannot be negative.`;
    case 'precision': return `${label} must use no more than 2 decimal places (whole pence).`;
    case 'unsafe': return `${label} is too large to store safely to the penny. Enter an absolute value of ${MAX_SAFE_MONEY_DISPLAY} or less.`;
    case 'zero': return `${label} must be greater than zero.`;
    default: return `Enter a valid ${label.toLowerCase()}.`;
  }
}

export function normaliseComparableLabel(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
}
