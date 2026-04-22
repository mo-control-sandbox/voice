import './Switch.css';

interface SwitchProps {
  /** Whether the switch is in the on state. */
  readonly checked: boolean;
  /** Called with the new state when the user toggles. */
  readonly onChange: (checked: boolean) => void;
  /** When true the switch is non-interactive and visually dimmed. */
  readonly disabled?: boolean;
  /** Links the switch to an external label element. */
  readonly id?: string;
}

/**
 * Accessible toggle switch with a sliding pill thumb.
 *
 * Renders as role="switch" so assistive technology announces on/off state
 * correctly. Visual state is driven by Switch.css via the aria-checked attribute.
 */
export function Switch({ checked, onChange, disabled = false, id }: SwitchProps): React.JSX.Element {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="switch"
      onClick={() => { onChange(!checked); }}
    >
      <span className="switch__thumb" />
    </button>
  );
}
