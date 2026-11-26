interface RangeBarProps {
  min: number;
  max: number;
  value: number;
  label: string;
}

export function RangeBar({ min, max, value, label }: RangeBarProps) {
  const span = max - min || 1;
  const clampedValue = Math.min(max, Math.max(min, value));
  const percentage = Math.min(100, Math.max(0, ((clampedValue - min) / span) * 100));

  return (
    <div
      className="ds-range-bar"
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedValue}
    >
      <span className="ds-range-track" />
      <span className="ds-range-marker" style={{ left: `${percentage}%` }} />
    </div>
  );
}

export type { RangeBarProps };
