import { lazy, Suspense } from 'react';
import { Avatar } from '../components/Avatar';
import { AVATAR_PRESETS } from '../assets/avatars/presets';

const Avatar3D = lazy(() => import('./Avatar3D'));
import type { AvatarChoice } from './choice';
import type { Mood } from './mood';

interface Props {
  choice: AvatarChoice;
  photo?: string | null;
  name?: string;
  size?: number;
  /** 0-100; draws a progress "aura" ring around the avatar. */
  score?: number | null;
  mood?: Mood;
  label?: string;
  /** Show the live 3D character (presets only). */
  threeD?: boolean;
}

/** The person's avatar inside a glowing ring that fills with the Balance Score. */
export function AuraAvatar({ choice, photo, name, size = 96, score, mood, label, threeD = false }: Props) {
  const color = mood?.color ?? 'var(--aura-primary)';
  const stroke = Math.max(3, Math.round(size * 0.06));
  const pad = stroke + Math.round(size * 0.05);
  const outer = size + pad * 2;
  const r = (outer - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = score === null || score === undefined ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const inner = size;

  let face;
  if (choice.kind === 'photo' && photo) {
    face = (
      <img
        src={photo}
        alt={label ?? 'Your profile photo'}
        style={{ width: inner, height: inner, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    );
  } else if (choice.kind === 'preset') {
    const flat = (
      <Avatar
        variant={choice.id}
        size={inner}
        ring={false}
        expression={mood ? { eyes: mood.eyes, mouth: mood.mouth } : undefined}
        alt={label}
        name={name}
      />
    );
    const preset = AVATAR_PRESETS.find((p) => p.id === choice.id);
    face =
      threeD && preset ? (
        <div
          role="img"
          aria-label={label ?? `${preset.label} 3D avatar. ${mood?.label ?? ''}`}
          style={{
            width: inner,
            height: inner,
            borderRadius: '50%',
            overflow: 'hidden',
            background: 'radial-gradient(circle at 38% 30%, #323848, #1F212C 60%, #070F0D)',
          }}
        >
          <Suspense fallback={flat}>
            <Avatar3D preset={preset} mood={mood} size={inner} halo={false} />
          </Suspense>
        </div>
      ) : (
        flat
      );
  } else {
    face = <Avatar variant="initials" size={inner} ring={false} name={name || 'AURA'} alt={label} />;
  }

  return (
    <div
      style={{
        position: 'relative',
        width: outer,
        height: outer,
        flex: '0 0 auto',
        borderRadius: '50%',
        boxShadow: mood && mood.tone !== 'none' ? `0 0 ${Math.round(size * 0.35)}px ${color}55` : undefined,
        transition: 'box-shadow 0.6s ease',
      }}
    >
      <svg width={outer} height={outer} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <circle cx={outer / 2} cy={outer / 2} r={r} stroke="var(--aura-border)" strokeOpacity={0.6} strokeWidth={stroke} fill="none" />
        {filled > 0 && <circle
          cx={outer / 2}
          cy={outer / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * filled} ${circ}`}
          transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />}
      </svg>
      <div style={{ position: 'absolute', left: pad, top: pad }}>{face}</div>
    </div>
  );
}
