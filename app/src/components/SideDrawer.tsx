import { useEffect, useRef } from 'react';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { useMe } from '../avatar/AvatarContext';
import type { AppTab, ThemeMode } from './AppShell';
import {
  AppsIcon,
  CloseIcon,
  DataIcon,
  GoalsIcon,
  InfoIcon,
  LockIcon,
  MoonIcon,
  PhoneIcon,
  SunIcon,
} from './Icons';

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  tab: AppTab;
  onNavigate: (tab: AppTab) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLock: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const DRAWER_LINKS: { id: AppTab; label: string; sub: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: 'goals', label: 'Goals', sub: 'Personal baselines & streaks', icon: GoalsIcon },
  { id: 'vault', label: 'My Data & Privacy', sub: 'Consent, audit log & network ledger', icon: DataIcon },
  { id: 'phone', label: 'Phone & band data', sub: 'Screen time & Health Connect sync', icon: PhoneIcon },
  { id: 'apps', label: 'App usage', sub: 'Per-app limits & opens', icon: AppsIcon },
  { id: 'about', label: 'About / Privacy', sub: 'How AURA protects your data', icon: InfoIcon },
];

export function SideDrawer({
  open,
  onClose,
  tab,
  onNavigate,
  theme,
  onToggleTheme,
  onLock,
  triggerRef,
}: SideDrawerProps) {
  const me = useMe();
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && focusables && focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  const go = (next: AppTab) => {
    onNavigate(next);
    onClose();
  };

  return (
    <div
      className="aura-drawer-backdrop"
      role="presentation"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current !== null && (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current < -50) {
          onClose();
        }
        touchStartX.current = null;
      }}
    >
      <aside
        ref={panelRef}
        className="aura-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="AURA menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between center-v">
          <div className="row center-v gap-sm">
            <span className="pill primary">
              <LockIcon size={12} />
              <span>Encrypted</span>
            </span>
          </div>
          <button type="button" className="btn ghost icon-only" onClick={onClose} aria-label="Close menu">
            <CloseIcon size={18} />
          </button>
        </div>

        <button
          type="button"
          className="aura-drawer-profile"
          onClick={() => go('profile')}
        >
          <AuraAvatar choice={me.choice} photo={me.photo} name={me.name} size={42} />
          <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 700 }}>{me.name || 'Your Profile'}</div>
            <div className="xs muted">Edit profile &amp; avatar</div>
          </div>
        </button>

        <nav className="aura-drawer-nav" aria-label="Secondary navigation">
          {DRAWER_LINKS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`aura-nav-btn ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => go(item.id)}
              >
                <Icon size={18} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span>{item.label}</span>
                  <span className="xs muted" style={{ fontWeight: 400 }}>{item.sub}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="aura-drawer-footer">
          <button type="button" className="aura-nav-btn" onClick={onToggleTheme}>
            {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            <span>{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
          </button>
          <button
            type="button"
            className="btn danger-outline"
            style={{ width: '100%' }}
            onClick={() => {
              onClose();
              onLock();
            }}
          >
            <LockIcon size={16} />
            <span>Lock AURA</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
