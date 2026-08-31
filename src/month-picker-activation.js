const DESKTOP_PICKER_MEDIA = '(min-width: 761px), (hover: hover) and (pointer: fine)';

export function installMonthPickerActivation(root = document) {
  const openMonthPicker = (event) => {
    const target = event.target;
    const input = target?.closest?.('.month-input');
    if (!input || input.disabled) return;

    // Penny's custom picker owns desktop/fine-pointer selection even when the
    // browser viewport is narrow because of zoom, scaling or window size.
    // The native picker remains for touch/mobile devices such as iPhone.
    if (globalThis.matchMedia?.(DESKTOP_PICKER_MEDIA).matches) return;

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
