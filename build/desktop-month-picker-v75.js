const APP_FILE_PATTERN = /[\\/]src[\\/]App\.jsx$/;

const COMPONENT = `function PennyDesktopMonthSelector({ period, monthKey, onSelectMonth }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(period.year);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setPickerYear(period.year);

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, period.year]);

  const chooseMonth = (value) => {
    onSelectMonth(value);
    setIsOpen(false);
    globalThis.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const chooseCurrentMonth = () => chooseMonth(currentLocalPeriod().key);

  return (
    <div className="month-control penny-month-selector" ref={rootRef}>
      <span className="month-display" aria-hidden="true">{SHORT_MONTHS[period.month]} {period.year}</span>
      <input
        className="month-input penny-month-native"
        aria-label="Selected month and year"
        type="month"
        value={monthKey}
        min="1900-01"
        onChange={(event) => onSelectMonth(event.target.value)}
      />
      <button
        ref={triggerRef}
        type="button"
        className="desktop-month-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => {
          setPickerYear(period.year);
          setIsOpen((open) => !open);
        }}
      >
        {SHORT_MONTHS[period.month]} {period.year}
      </button>
      {isOpen && (
        <div className="desktop-month-popover" role="dialog" aria-label="Choose month and year">
          <div className="desktop-month-picker-header">
            <button type="button" className="desktop-month-year-arrow" aria-label="Previous year" onClick={() => setPickerYear((year) => year - 1)}>‹</button>
            <div className="desktop-month-year" aria-live="polite">{pickerYear}</div>
            <button type="button" className="desktop-month-year-arrow" aria-label="Next year" onClick={() => setPickerYear((year) => year + 1)}>›</button>
          </div>
          <div className="desktop-month-grid" role="grid" aria-label={\`Months in \${pickerYear}\`}>
            {SHORT_MONTHS.map((label, monthIndex) => {
              const value = mkKey(pickerYear, monthIndex);
              const selected = value === monthKey;
              return (
                <button
                  key={value}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  className={selected ? 'selected' : ''}
                  onClick={() => chooseMonth(value)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="desktop-month-picker-footer">
            <button type="button" className="desktop-month-current" onClick={chooseCurrentMonth}>This month</button>
          </div>
        </div>
      )}
    </div>
  );
}

`;

const SELECTOR = `          <div className="month-control">\n            <span className="month-display" aria-hidden="true">{SHORT_MONTHS[period.month]} {period.year}</span>\n            <input\n              className="month-input"\n              aria-label="Selected month and year"\n              type="month"\n              value={monthKey}\n              min="1900-01"\n              onChange={(event) => setMonthValue(event.target.value, { followCurrent: false })}\n            />\n          </div>`;

export function transformDesktopMonthPickerV75(source) {
  if (source.includes('function PennyDesktopMonthSelector')) return source;
  if (!source.includes(SELECTOR)) throw new Error('v75 could not find the v74 month selector output.');
  if (!source.includes('function App() {')) throw new Error('v75 could not find App component boundary.');

  let next = source.replace('function App() {', `${COMPONENT}function App() {`);
  next = next.replace(
    SELECTOR,
    `          <PennyDesktopMonthSelector\n            period={period}\n            monthKey={monthKey}\n            onSelectMonth={(value) => setMonthValue(value, { followCurrent: false })}\n          />`,
  );
  return next;
}

export function desktopMonthPickerV75Plugin() {
  return {
    name: 'penny-desktop-month-picker-v75',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0];
      if (!APP_FILE_PATTERN.test(cleanId)) return null;
      const transformed = transformDesktopMonthPickerV75(code);
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}
