interface ShortcutKeycapsProps {
  readonly shortcut: string;
  readonly large?: boolean;
}

/**
 * Renders a shortcut accelerator as a row of keycap-style tokens.
 */
export function ShortcutKeycaps(props: ShortcutKeycapsProps): React.JSX.Element {
  const { shortcut, large = false } = props;
  const tokens = shortcut.split('+').filter((token) => token.trim() !== '');
  const visibleTokens = tokens.map((token): { symbol: string; label: string } => {
    if (token === 'CommandOrControl' || token === 'Command') return { symbol: '⌘', label: 'Command' };
    if (token === 'Control') return { symbol: '⌃', label: 'Control' };
    if (token === 'Alt') return { symbol: '⌥', label: 'Option' };
    if (token === 'Shift') return { symbol: '⇧', label: 'Shift' };
    if (token === 'Space') return { symbol: '␣', label: 'Space' };
    return { symbol: token, label: token };
  });

  return (
    <div
      className={`shortcut-keycaps ${large ? 'shortcut-keycaps--large' : ''}`}
      aria-label={`Shortcut ${shortcut}`}
    >
      {visibleTokens.map((token, index) => (
        <kbd key={`${token.label}-${String(index)}`} className="shortcut-keycaps__key">
          <span className="shortcut-keycaps__symbol">{token.symbol}</span>
          <span className="shortcut-keycaps__label">{token.label}</span>
        </kbd>
      ))}
    </div>
  );
}
