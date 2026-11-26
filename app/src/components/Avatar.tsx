import type { CSSProperties } from 'react';

export type AvatarVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'initials';

interface AvatarProps {
  variant?: AvatarVariant;
  size?: number;
  name?: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

function getInitials(name?: string): string {
  if (!name?.trim()) return 'AU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function renderAbstractVariant(variant: Exclude<AvatarVariant, 'initials'>) {
  switch (variant) {
    case 0:
      return (
        <>
          <circle cx="128" cy="128" r="88" fill="var(--aura-primary)" fillOpacity="0.12" />
          <circle cx="128" cy="128" r="68" stroke="var(--aura-primary)" strokeWidth="14" />
          <circle cx="128" cy="128" r="24" fill="var(--aura-primary)" />
        </>
      );
    case 1:
      return (
        <>
          <circle cx="128" cy="128" r="78" stroke="var(--aura-blue)" strokeOpacity="0.45" strokeWidth="10" />
          <path d="M 128 50 A 78 78 0 1 1 57 160" stroke="var(--aura-primary)" strokeWidth="16" strokeLinecap="round" />
          <circle cx="128" cy="128" r="28" fill="var(--aura-blue)" fillOpacity="0.3" />
          <circle cx="128" cy="128" r="14" fill="var(--aura-primary)" />
        </>
      );
    case 2:
      return (
        <>
          <circle cx="118" cy="134" r="72" stroke="var(--aura-purple)" strokeOpacity="0.55" strokeWidth="10" />
          <circle cx="136" cy="120" r="64" stroke="var(--aura-primary)" strokeWidth="14" />
          <circle cx="136" cy="120" r="18" fill="var(--aura-purple)" />
        </>
      );
    case 3:
      return (
        <>
          <circle cx="128" cy="128" r="82" stroke="var(--aura-border)" strokeWidth="16" />
          <circle cx="128" cy="128" r="56" stroke="var(--aura-primary)" strokeWidth="12" />
          <circle cx="128" cy="128" r="30" stroke="var(--aura-blue)" strokeWidth="10" />
          <circle cx="176" cy="92" r="11" fill="var(--aura-primary)" />
        </>
      );
    case 4:
      return (
        <>
          <path d="M 56 128 A 72 72 0 0 1 200 128" stroke="var(--aura-primary)" strokeWidth="18" strokeLinecap="round" />
          <path d="M 200 128 A 72 72 0 0 1 56 128" stroke="var(--aura-purple)" strokeOpacity="0.7" strokeWidth="10" strokeLinecap="round" />
          <circle cx="128" cy="128" r="22" fill="var(--aura-primary)" />
        </>
      );
    case 5:
      return (
        <>
          <circle cx="128" cy="128" r="76" stroke="var(--aura-primary)" strokeOpacity="0.25" strokeWidth="24" />
          <circle cx="128" cy="128" r="54" stroke="var(--aura-primary)" strokeWidth="10" />
          <circle cx="166" cy="166" r="14" fill="var(--aura-blue)" />
          <circle cx="94" cy="96" r="10" fill="var(--aura-purple)" />
        </>
      );
    case 6:
      return (
        <>
          <circle cx="114" cy="114" r="54" fill="var(--aura-primary)" fillOpacity="0.2" stroke="var(--aura-primary)" strokeWidth="12" />
          <circle cx="148" cy="148" r="48" fill="var(--aura-blue)" fillOpacity="0.18" stroke="var(--aura-blue)" strokeWidth="10" />
          <circle cx="128" cy="128" r="12" fill="var(--aura-text)" />
        </>
      );
    case 7:
      return (
        <>
          <circle cx="128" cy="128" r="80" stroke="var(--aura-border)" strokeWidth="8" />
          <path d="M 128 48 A 80 80 0 0 1 208 128" stroke="var(--aura-primary)" strokeWidth="16" strokeLinecap="round" />
          <path d="M 128 208 A 80 80 0 0 1 48 128" stroke="var(--aura-purple)" strokeWidth="16" strokeLinecap="round" />
          <circle cx="128" cy="128" r="24" fill="var(--aura-primary)" fillOpacity="0.25" stroke="var(--aura-primary)" strokeWidth="6" />
        </>
      );
  }
}

export function Avatar({
  variant = 0,
  size = 36,
  name,
  alt,
  className = '',
  style,
}: AvatarProps) {
  const label = alt ?? (name ? `${name} avatar` : 'AURA profile avatar');

  if (variant === 'initials') {
    const initials = getInitials(name);
    return (
      <div
        role="img"
        aria-label={label}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--aura-surface)',
          border: '2px solid var(--aura-primary)',
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

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      role="img"
      aria-label={label}
      className={className}
      style={{
        borderRadius: '50%',
        background: 'var(--aura-shell)',
        border: '1px solid var(--aura-border)',
        flexShrink: 0,
        display: 'block',
        ...style,
      }}
    >
      {renderAbstractVariant(variant)}
    </svg>
  );
}
