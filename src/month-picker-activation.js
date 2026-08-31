export function installMonthPickerActivation(root = document) {
  const openMonthPicker = (event) => {
    const target = event.target;
    const input = target?.closest?.('.month-input');
    if (!input || input.disabled) return;

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // Native click behaviour remains available when showPicker is unsupported
        // or the browser decides the picker is already open.
      }
    }
  };

  root.addEventListener('click', openMonthPicker);
  return () => root.removeEventListener('click', openMonthPicker);
}
