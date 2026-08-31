const APP_FILE_PATTERN = /[\\/]src[\\/]App\.jsx$/;

export function transformMonthSelectorV74(source) {
  if (source.includes('className="month-display"')) return source;

  const target = '          <div className="month-control">\n            <input\n              className="month-input"';
  if (!source.includes(target)) {
    throw new Error('v74 could not find the native month selector in App.jsx.');
  }

  return source.replace(
    target,
    '          <div className="month-control">\n            <span className="month-display" aria-hidden="true">{SHORT_MONTHS[period.month]} {period.year}</span>\n            <input\n              className="month-input"',
  );
}

export function monthSelectorV74Plugin() {
  return {
    name: 'penny-month-selector-v74',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0];
      if (!APP_FILE_PATTERN.test(cleanId)) return null;
      const transformed = transformMonthSelectorV74(code);
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}
