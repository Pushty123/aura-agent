import { IconTile, type MetricKind } from './IconTile';
import { RangeBar, type RangeBarProps } from './RangeBar';

interface MetricCardProps {
  kind: MetricKind;
  label: string;
  value: string | number;
  unit?: string;
  timestamp: string;
  range?: RangeBarProps;
  demo?: boolean;
}

export function MetricCard({ kind, label, value, unit, timestamp, range, demo }: MetricCardProps) {
  return (
    <article className="ds-metric-card" data-metric={kind}>
      <IconTile kind={kind} />
      <div className="ds-metric-content">
        <div className="ds-metric-heading">
          <div className="ds-metric-label-group">
            <h3 className="ds-metric-label">{label}</h3>
            <p className="ds-metric-timestamp">{timestamp}</p>
            {demo && <span className="ds-demo-badge">DEMO</span>}
          </div>
          <p className="ds-metric-value">
            {value}
            {unit && <span className="ds-metric-unit"> {unit}</span>}
          </p>
        </div>
        {range && <RangeBar {...range} />}
      </div>
    </article>
  );
}

export type { MetricCardProps };
