export function installMonthPickerActivation(root = document) {
  const openMonthPicker = (event) => {
    const target = event.target;
    const input = target?.closest?.('.month-input');
    if (!input || input.disabled) return;

    // v75 owns desktop month selection with Penny's custom picker.
    // The v78 showPicker() assist is only for the native mobile/iPhone control.
    if (globalThis.matchMedia?.('(min-width: 761px)').matches) return;

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
