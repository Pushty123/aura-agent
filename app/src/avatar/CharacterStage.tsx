import type { Character } from './characters';
import { poseFor } from './characters';
import type { Mood } from './mood';

/** Full-body character standing on a soft glowing floor, gently breathing. */
export function CharacterStage({
  character,
  mood,
  height = 260,
  sleepy = false,
  active = false,
}: {
  character: Character;
  mood?: Mood;
  height?: number;
  sleepy?: boolean;
  active?: boolean;
}) {
  const color = mood?.color ?? '#35CFC8';
  const src = poseFor(character, mood?.tone ?? 'none', sleepy, active);
  return (
    <div
      role="img"
      aria-label={`${character.name}${mood ? `, ${mood.label}` : ''}`}
      className="aura-stage"
      style={{ position: 'relative', height, width: Math.round(height * 0.62), flex: '0 0 auto' }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          top: '8%',
          width: '120%',
          height: '80%',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}40 0%, ${color}10 45%, transparent 70%)`,
          transition: 'background 0.6s ease',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 2,
          width: '78%',
          height: 16,
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${color}66 0%, rgba(0,0,0,0.35) 45%, transparent 72%)`,
        }}
      />
      <img
        src={src}
        alt=""
        draggable={false}
        className="aura-breathe"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 8, margin: '0 auto', height: height - 14, width: 'auto' }}
      />
    </div>
  );
}
