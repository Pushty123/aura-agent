import { Avatar } from '../components/Avatar';
import { characterById } from './characters';
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
}

/** The person's avatar inside a glowing ring that fills with the Balance Score. */
export function AuraAvatar({ choice, photo, name, size = 96, score, mood, label }: Props) {
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
  } else if (choice.kind === 'character' && characterById(choice.id)) {
    const c = characterById(choice.id)!;
    face = (
      <div
        role="img"
        aria-label={label ?? `${c.name} avatar`}
        style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'radial-gradient(circle at 50% 35%, #3a3f55, #1F212C 70%)',
          position: 'relative',
        }}
      >
        <img
          src={c.poses.standing}
          alt=""
          draggable={false}
          style={{ position: 'absolute', height: inner * 4.2, width: 'auto', maxWidth: 'none', left: '50%', top: inner * 0.52 - c.faceY * inner * 4.2, transform: 'translateX(-50%)' }}
        />
      </div>
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
