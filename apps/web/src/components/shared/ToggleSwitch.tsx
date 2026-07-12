'use client';

type ToggleSwitchProps = {
  enabled: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  size?: 'sm' | 'md';
};

export default function ToggleSwitch({
  enabled,
  disabled,
  busy,
  onChange,
  label,
  size = 'md',
}: ToggleSwitchProps) {
  const track = size === 'sm' ? 'h-6 w-10' : 'h-7 w-12';
  const knob = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const onTranslate = size === 'sm' ? 'translate-x-5' : 'translate-x-6';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled || busy}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!enabled);
      }}
      className={`relative inline-flex ${track} shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
        enabled ? 'bg-emerald-500' : 'bg-gray-300'
      }`}
      title={enabled ? 'Active — click to disable' : 'Inactive — click to enable'}
    >
      <span
        className={`inline-block ${knob} transform rounded-full bg-white shadow transition-transform ${
          enabled ? onTranslate : 'translate-x-1'
        }`}
      />
    </button>
  );
}
