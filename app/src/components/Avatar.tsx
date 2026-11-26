import { useId, type CSSProperties } from 'react';
import { AVATAR_PRESETS, type AvatarPreset, type AvatarPresetId } from '../assets/avatars/presets';
import { buildAvatarSvgInner } from '../assets/avatars/kit';

export type AvatarVariant = AvatarPresetId | 'initials';

interface AvatarProps {
  variant?: AvatarVariant;
  size?: number;
  name?: string;
  alt?: string;
  ring?: boolean;
  /** Override the preset's eyes and mouth (used for the mood-reactive avatar). */
  expression?: Partial<Pick<AvatarPreset, 'eyes' | 'mouth'>>;
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}

function getInitials(name?: string): string {
  if (!name?.trim()) return 'AU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({
  variant = '01-sunny-curls',
  size = 36,
  name,
  alt,
  ring = true,
  expression,
  decorative = false,
  className = '',
  style,
}: AvatarProps) {
  const uid = useId().replace(/:/g, '');
  const preset = variant !== 'initials' ? AVATAR_PRESETS.find((p) => p.id === variant) : undefined;
  const ariaLabel = decorative ? undefined : (alt ?? preset?.alt ?? (name ? `${name} avatar` : 'AURA profile avatar'));

  if (!preset) {
    const initials = getInitials(name);
    return (
      <div
        role={decorative ? undefined : 'img'}
        aria-label={ariaLabel}
        aria-hidden={decorative ? 'true' : undefined}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--aura-surface)',
          border: ring ? '2px solid var(--aura-primary)' : '1px solid var(--aura-border)',
          color: 'var(--aura-text)',
          display: 'inline-grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: Math.max(11, Math.round(size * 0.38)),
          flexShrink: 0,
          userSelect: 'none',
          ...style,
        }}
      >
        {initials}
      </div>
    );
  }

  const innerSvg = buildAvatarSvgInner(expression ? { ...preset, ...expression } : preset, uid);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      role={decorative ? undefined : 'img'}
      aria-label={ariaLabel}
      aria-hidden={decorative ? 'true' : undefined}
      className={className}
      style={{
        borderRadius: '50%',
        border: ring ? '1.5px solid var(--aura-primary)' : '1px solid var(--aura-border)',
        flexShrink: 0,
        display: 'block',
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: innerSvg }}
    />
  );
}
