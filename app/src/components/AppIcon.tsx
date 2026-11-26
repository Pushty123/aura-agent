import { useState } from 'react';

export type KnownAppKey =
  | 'spotify'
  | 'instagram'
  | 'youtube'
  | 'whatsapp'
  | 'chrome'
  | 'gmail'
  | 'tiktok'
  | 'x'
  | 'facebook'
  | 'messenger'
  | 'snapchat'
  | 'reddit'
  | 'discord'
  | 'telegram'
  | 'netflix'
  | 'slack'
  | 'linkedin'
  | 'twitch'
  | 'maps';

const PKG_MAP: Record<string, KnownAppKey> = {
  'com.spotify.music': 'spotify',
  'com.spotify.lite': 'spotify',
  'com.instagram.android': 'instagram',
  'com.instagram.lite': 'instagram',
  'com.google.android.youtube': 'youtube',
  'com.google.android.apps.youtube.music': 'youtube',
  'com.whatsapp': 'whatsapp',
  'com.whatsapp.w4b': 'whatsapp',
  'com.android.chrome': 'chrome',
  'com.chrome.beta': 'chrome',
  'com.chrome.dev': 'chrome',
  'com.google.android.gm': 'gmail',
  'com.zhiliaoapp.musically': 'tiktok',
  'com.ss.android.ugc.trill': 'tiktok',
  'com.twitter.android': 'x',
  'com.facebook.katana': 'facebook',
  'com.facebook.lite': 'facebook',
  'com.facebook.orca': 'messenger',
  'com.snapchat.android': 'snapchat',
  'com.reddit.frontpage': 'reddit',
  'com.discord': 'discord',
  'org.telegram.messenger': 'telegram',
  'com.netflix.mediaclient': 'netflix',
  'com.Slack': 'slack',
  'com.linkedin.android': 'linkedin',
  'tv.twitch.android.app': 'twitch',
  'com.google.android.apps.maps': 'maps',
};

const LABEL_KEYWORDS: [RegExp, KnownAppKey][] = [
  [/\bspotify\b/i, 'spotify'],
  [/\binstagram\b/i, 'instagram'],
  [/\byoutube\b/i, 'youtube'],
  [/\bwhatsapp\b/i, 'whatsapp'],
  [/\bchrome\b/i, 'chrome'],
  [/\bgmail\b/i, 'gmail'],
  [/\btiktok\b/i, 'tiktok'],
  [/\b(twitter|x)\b/i, 'x'],
  [/\bfacebook\b/i, 'facebook'],
  [/\bmessenger\b/i, 'messenger'],
  [/\bsnapchat\b/i, 'snapchat'],
  [/\breddit\b/i, 'reddit'],
  [/\bdiscord\b/i, 'discord'],
  [/\btelegram\b/i, 'telegram'],
  [/\bnetflix\b/i, 'netflix'],
  [/\bslack\b/i, 'slack'],
  [/\blinkedin\b/i, 'linkedin'],
  [/\btwitch\b/i, 'twitch'],
  [/\bmaps\b/i, 'maps'],
];

/** Dynamically resolves a known app key from Android package name or display label. */
export function resolveAppIconKey(pkg: string, label: string): KnownAppKey | null {
  const byPkg = PKG_MAP[pkg] ?? PKG_MAP[pkg.toLowerCase()];
  if (byPkg) return byPkg;

  for (const [pattern, key] of LABEL_KEYWORDS) {
    if (pattern.test(label) || pattern.test(pkg)) return key;
  }
  return null;
}

function fallbackHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function BrandSvg({ app, size }: { app: KnownAppKey; size: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 36 36',
    fill: 'none' as const,
    'aria-hidden': true as const,
    style: { flexShrink: 0, display: 'block' },
  };

  switch (app) {
    case 'spotify':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#1DB954" />
          <path d="M9.5 14.2c5.4-1.6 12.1-1.3 16.8 1.1" stroke="#0B130E" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M10.8 18.7c4.4-1.2 9.8-1 13.7 1" stroke="#0B130E" strokeWidth="2.3" strokeLinecap="round" />
          <path d="M12.2 23c3.4-.9 7.5-.7 10.6.8" stroke="#0B130E" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="aura-ig" x1="4" y1="32" x2="32" y2="4" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#F58529" />
              <stop offset="0.5" stopColor="#DD2A7B" />
              <stop offset="1" stopColor="#515BD4" />
            </linearGradient>
          </defs>
          <rect width="36" height="36" rx="9" fill="url(#aura-ig)" />
          <rect x="8.5" y="8.5" width="19" height="19" rx="5.5" stroke="#FFFFFF" strokeWidth="2.2" />
          <circle cx="18" cy="18" r="4.3" stroke="#FFFFFF" strokeWidth="2.2" />
          <circle cx="23.6" cy="12.4" r="1.3" fill="#FFFFFF" />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#FF0033" />
          <rect x="6.5" y="10" width="23" height="16" rx="4.5" fill="#FFFFFF" />
          <path d="M15.5 14.3L22.3 18l-6.8 3.7v-7.4Z" fill="#FF0033" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#25D366" />
          <path
            d="M18 8.5a9.3 9.3 0 0 0-8 14l-1.2 4.5 4.6-1.2A9.3 9.3 0 1 0 18 8.5Z"
            stroke="#FFFFFF"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path
            d="M14.7 14.2c.3-.6.6-.6.9-.6h.7c.2 0 .5.1.6.4l.8 1.9c.1.3.1.5-.1.7l-.5.6c-.2.2-.2.4 0 .7.5.9 1.3 1.7 2.2 2.2.3.2.5.2.7 0l.6-.5c.2-.2.4-.2.7-.1l1.9.8c.3.1.4.4.4.6v.7c0 .3 0 .6-.6.9-.7.4-2.1.4-4.1-.6-2-1-3.5-2.6-4.5-4.6-.9-1.9-.9-3.3-.6-4Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    case 'chrome':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#FFFFFF" />
          <circle cx="18" cy="18" r="10.5" fill="#FBBC05" />
          <path d="M18 7.5a10.5 10.5 0 0 1 9.1 5.3H18V7.5Z" fill="#EA4335" />
          <path d="M8.9 12.8A10.5 10.5 0 0 1 18 7.5v5.3H8.9Z" fill="#EA4335" />
          <path d="M8.9 12.8 13.5 21 18 28.5a10.5 10.5 0 0 1-9.1-15.7Z" fill="#34A853" />
          <circle cx="18" cy="18" r="5" fill="#FFFFFF" />
          <circle cx="18" cy="18" r="3.7" fill="#4285F4" />
        </svg>
      );
    case 'gmail':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#FFFFFF" />
          <path d="M8 13.5V25a1.5 1.5 0 0 0 1.5 1.5H12v-9.2l-4-3.8Z" fill="#4285F4" />
          <path d="M28 13.5V25a1.5 1.5 0 0 1-1.5 1.5H24v-9.2l4-3.8Z" fill="#34A853" />
          <path d="M24 17.3V11l4-1.5a1.6 1.6 0 0 1 0 2.6l-4 5.2Z" fill="#FBBC04" />
          <path d="M12 17.3 18 21.8l6-4.5V11l-6 4.5L12 11v6.3Z" fill="#EA4335" />
          <path d="M8 12.1a1.6 1.6 0 0 1 2.6-1.2L12 12v5.3l-4-3.8v-1.4Z" fill="#C5221F" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#111111" />
          <path d="M20.5 9.5v11.2a4.3 4.3 0 1 1-3-4.1" stroke="#25F4EE" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M20.5 9.5c1 2.2 2.9 3.6 5.2 3.9" stroke="#FE2C55" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M19.8 10.2v11.2a4.3 4.3 0 1 1-3-4.1" stroke="#FFFFFF" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#111418" />
          <path d="M10.5 10.5 25.5 25.5M25.5 10.5 10.5 25.5" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#1877F2" />
          <path d="M20.5 28v-8.5h2.8l.5-3.3h-3.3v-2.1c0-1 .3-1.6 1.7-1.6H24V9.6c-.4-.1-1.4-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4h-2.8v3.3h2.8V28h3.2Z" fill="#FFFFFF" />
        </svg>
      );
    case 'messenger':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#0084FF" />
          <path d="M18 8.5c-5.4 0-9.6 4-9.6 9.1 0 2.9 1.4 5.4 3.6 7.1v3.3l3.2-1.8c.9.2 1.8.4 2.8.4 5.4 0 9.6-4 9.6-9.1S23.4 8.5 18 8.5Z" fill="#FFFFFF" />
          <path d="m12.8 19.7 3.9-4.1 2 2.1 3.7-2.1-3.9 4.1-2-2.1-3.7 2.1Z" fill="#0084FF" />
        </svg>
      );
    case 'snapchat':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#FFFC00" />
          <path d="M18 9.5c-3 0-4.8 2.2-4.8 5.2v2c-.9.3-1.7.7-1.7 1.3s.9.8 1.5 1c-.2 1.7-1.6 2.8-3 3.3-.4.2-.4.7.1.9 1.4.5 2.4.7 3 1.4.4.4 1.3.4 1.9.1.9-.4 1.9-.4 3-.4s2.1 0 3 .4c.6.3 1.5.3 1.9-.1.6-.7 1.6-.9 3-1.4.5-.2.5-.7.1-.9-1.4-.5-2.8-1.6-3-3.3.6-.2 1.5-.4 1.5-1s-.8-1-1.7-1.3v-2c0-3-1.8-5.2-4.8-5.2Z" fill="#FFFFFF" stroke="#111111" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case 'reddit':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#FF4500" />
          <circle cx="18" cy="19.5" r="7" fill="#FFFFFF" />
          <circle cx="15.3" cy="19" r="1.2" fill="#FF4500" />
          <circle cx="20.7" cy="19" r="1.2" fill="#FF4500" />
          <path d="M15.4 22c1.6 1 3.6 1 5.2 0" stroke="#FF4500" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M18 12.5 19.6 9.5l2.7.7" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="23.2" cy="10.4" r="1.3" fill="#FFFFFF" />
        </svg>
      );
    case 'discord':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#5865F2" />
          <path d="M12.5 13c1.8-.9 3.7-1.2 5.5-1.2s3.7.3 5.5 1.2c1.2 2.2 1.8 4.8 1.5 8.1-1.6 1.2-3.2 1.8-4.7 2l-.8-1.3c.7-.2 1.3-.5 1.9-.9-.3-.2-.6-.4-.9-.6-1.6.7-3.4.7-5 0-.3.2-.6.4-.9.6.6.4 1.2.7 1.9.9l-.8 1.3c-1.5-.2-3.1-.8-4.7-2-.3-3.3.3-5.9 1.5-8.1Z" fill="#FFFFFF" />
          <circle cx="15.4" cy="17.8" r="1.3" fill="#5865F2" />
          <circle cx="20.6" cy="17.8" r="1.3" fill="#5865F2" />
        </svg>
      );
    case 'telegram':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#26A5E4" />
          <path d="m9.5 17.8 15.6-6.1-2.5 14.5-4.7-3.5-2.6 2.4.4-4.2 6.8-6.2-8.5 5.2-4.5-2.1Z" fill="#FFFFFF" />
        </svg>
      );
    case 'netflix':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#141414" />
          <path d="M12 26V10h3.2l5.6 10.6V10H24v16h-3.1L15.2 15.2V26H12Z" fill="#E50914" />
        </svg>
      );
    case 'slack':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#4A154B" />
          <rect x="15" y="9" width="2.6" height="7" rx="1.3" fill="#36C5F0" />
          <rect x="18.4" y="20" width="2.6" height="7" rx="1.3" fill="#ECB22E" />
          <rect x="9" y="18.4" width="7" height="2.6" rx="1.3" fill="#E01E5A" />
          <rect x="20" y="15" width="7" height="2.6" rx="1.3" fill="#2EB67D" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#0A66C2" />
          <circle cx="12.2" cy="12" r="1.7" fill="#FFFFFF" />
          <rect x="10.8" y="15.2" width="2.8" height="10.3" rx="0.6" fill="#FFFFFF" />
          <path d="M16.2 15.2h2.7v1.4c.6-.9 1.6-1.6 3-1.6 2.4 0 3.7 1.6 3.7 4.4v6.1h-2.8v-5.5c0-1.5-.6-2.4-1.8-2.4-1.3 0-2 .9-2 2.4v5.5h-2.8V15.2Z" fill="#FFFFFF" />
        </svg>
      );
    case 'twitch':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#9146FF" />
          <path d="M11 10h15v10.5l-4 4h-3.5L16 27v-2.5h-5V10Z" fill="#FFFFFF" />
          <rect x="17" y="14" width="2" height="5" rx="0.8" fill="#9146FF" />
          <rect x="21.5" y="14" width="2" height="5" rx="0.8" fill="#9146FF" />
        </svg>
      );
    case 'maps':
      return (
        <svg {...common}>
          <rect width="36" height="36" rx="9" fill="#E8F0FE" />
          <path d="M18 8.5a6.5 6.5 0 0 0-6.5 6.5c0 4.8 6.5 12.5 6.5 12.5s6.5-7.7 6.5-12.5A6.5 6.5 0 0 0 18 8.5Z" fill="#EA4335" />
          <circle cx="18" cy="15" r="2.5" fill="#FFFFFF" />
        </svg>
      );
  }
}

interface AppIconProps {
  pkg: string;
  label: string;
  icon?: string;
  size?: number;
}

/**
 * Renders the native app icon when available, dynamically resolves crisp brand
 * icons for common apps (Spotify, Instagram, YouTube, WhatsApp, Chrome, Gmail, etc.),
 * and falls back to a deterministic initial badge if unrecognized.
 */
export function AppIcon({ pkg, label, icon, size = 34 }: AppIconProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (icon && !imgFailed) {
    return (
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        onError={() => setImgFailed(true)}
        style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  const known = resolveAppIconKey(pkg, label);
  if (known) {
    return <BrandSvg app={known} size={size} />;
  }

  const hue = fallbackHue(pkg || label);
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: `hsla(${hue}, 65%, 52%, 0.18)`,
        color: `hsl(${hue}, 70%, 62%)`,
        border: `1px solid hsla(${hue}, 65%, 52%, 0.35)`,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {(label.trim()[0] ?? '?').toUpperCase()}
    </div>
  );
}
