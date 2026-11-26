import { useEffect } from 'react';
import { CharacterStage } from './CharacterStage';
import { characterById } from './characters';
import type { AvatarChoice } from './choice';
import type { Mood } from './mood';

/** Full-body view of the person's character, shown only when they tap their avatar. */
export function CharacterModal({
  choice,
  mood,
  score,
  sleepy,
  active,
  onClose,
  onChange,
}: {
  choice: AvatarChoice;
  mood?: Mood;
  score?: number | null;
  sleepy?: boolean;
  active?: boolean;
  onClose: () => void;
  onChange?: () => void;
}) {
  const c = choice.kind === 'character' ? characterById(choice.id) : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!c) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${c.name}, your character`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(5, 8, 12, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <div
        className="card stack-sm"
        onClick={(e) => e.stopPropagation()}
        style={{ alignItems: 'center', textAlign: 'center', maxWidth: 340, width: '100%' }}
      >
        <CharacterStage character={c} mood={mood} height={380} sleepy={sleepy} active={active} />
        <h2 style={{ margin: 0 }}>{c.name}</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {mood ? mood.label : c.tagline}
          {typeof score === 'number' ? ` · Balance ${score}` : ''}
        </p>
        <div className="row gap" style={{ justifyContent: 'center' }}>
          {onChange && (
            <button type="button" className="btn" onClick={onChange}>
              Change character
            </button>
          )}
          <button type="button" className="btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
