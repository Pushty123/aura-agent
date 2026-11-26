import {
  Activity,
  Dumbbell,
  Droplets,
  Footprints,
  Heart,
  Moon,
  Smile,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

export type MetricKind =
  | 'heart'
  | 'exercise'
  | 'blood-pressure'
  | 'sleep'
  | 'steps'
  | 'water'
  | 'mood'
  | 'food';

const METRIC_ICONS: Record<MetricKind, LucideIcon> = {
  heart: Heart,
  exercise: Dumbbell,
  'blood-pressure': Activity,
  sleep: Moon,
  steps: Footprints,
  water: Droplets,
  mood: Smile,
  food: Utensils,
};

interface IconTileProps {
  kind: MetricKind;
  size?: number;
}

export function IconTile({ kind, size = 22 }: IconTileProps) {
  const Icon = METRIC_ICONS[kind];
  return (
    <span className="ds-icon-tile" data-metric={kind} aria-hidden="true">
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}
