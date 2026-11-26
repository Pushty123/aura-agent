import { AuraAvatar } from '../avatar/AuraAvatar';
import { useMe } from '../avatar/AvatarContext';
import type { AppTab } from '../components/AppShell';
import type { ThemePreference } from '../lib/theme';

const ROWS: { tab: AppTab; title: string; sub: string; emoji: string }[] = [
  { tab: 'profile', title: 'Profile & security', sub: 'Character, details, fingerprint, widget', emoji: '👤' },
  { tab: 'permissions', title: 'Permissions', sub: 'Choose which data sources AURA can access', emoji: '🛡️' },
  { tab: 'vault', title: 'My data & privacy', sub: 'Consent, export, delete, network log', emoji: '🔐' },
  { tab: 'about', title: 'About AURA', sub: 'How your data is protected', emoji: 'ℹ️' },
];

/** "Me" hub: everything personal and settings-like in one calm list. */
export function Me({
  onOpen,
  theme,
  onThemeChange,
  onLock,
}: {
  onOpen: (tab: AppTab) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onLock: () => void;
}) {
  const me = useMe();
  return (
    <section className="stack-lg">
      <button type="button" className="card row center-v gap me-hero" onClick={() => onOpen('profile')}>
        <AuraAvatar choice={me.choice} photo={me.photo} name={me.name} size={64} />
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ margin: 0 }}>{me.name || 'Set up your profile'}</h2>
          <p className="xs muted" style={{ margin: 0 }}>
            Encrypted on this device
          </p>
        </div>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: '1.4rem' }}>
          ›
        </span>
      </button>

      <div className="card list-card">
        {ROWS.map((r) => (
          <button key={r.tab} type="button" className="list-row" onClick={() => onOpen(r.tab)}>
            <span className="list-emoji" aria-hidden="true">
              {r.emoji}
            </span>
            <span className="list-text">
              <strong>{r.title}</strong>
              <span className="xs muted">{r.sub}</span>
            </span>
            <span className="muted" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>

      <div className="card list-card">
        <label className="list-row">
          <span className="list-emoji" aria-hidden="true">🎨</span>
          <span className="list-text">
            <strong>Theme</strong>
            <span className="xs muted">Choose light, dark, or follow your device</span>
          </span>
          <select
            className="input"
            aria-label="Theme"
            value={theme}
            onChange={(event) => onThemeChange(event.target.value as ThemePreference)}
            style={{ width: 'auto', minWidth: 112 }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <button type="button" className="list-row" onClick={onLock}>
          <span className="list-emoji" aria-hidden="true">
            🔒
          </span>
          <span className="list-text">
            <strong>Lock AURA</strong>
          </span>
        </button>
      </div>
    </section>
  );
}
