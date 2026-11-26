import type { ReactNode } from 'react';
import {
  AskIcon,
  AuraLogoIcon,
  CheckInIcon,
  DataIcon,
  FoodIcon,
  GoalsIcon,
  InfoIcon,
  LockIcon,
  MoonIcon,
  SunIcon,
  TodayIcon,
} from './Icons';

export type AppTab = 'dashboard' | 'checkin' | 'food' | 'goals' | 'ask' | 'vault' | 'about';
export type ThemeMode = 'dark' | 'light';

interface NavItem {
  id: AppTab;
  label: string;
  subtitle: string;
  icon: (props: { size?: number }) => JSX.Element;
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Today', subtitle: 'Your daily balance, insights and trends', icon: TodayIcon },
  { id: 'checkin', label: 'Check-in', subtitle: 'Quick mood, sleep and daily habits', icon: CheckInIcon },
  { id: 'goals', label: 'Goals', subtitle: 'Personal baselines from your own history', icon: GoalsIcon },
  { id: 'food', label: 'Food', subtitle: 'Approximate daily nutrition log', icon: FoodIcon },
  { id: 'ask', label: 'Ask AURA', subtitle: 'Evidence-backed answers & confirmed actions', icon: AskIcon },
  { id: 'vault', label: 'My Data', subtitle: 'Consent, network ledger, CSV import & vault', icon: DataIcon },
];

const ABOUT_NAV: NavItem = {
  id: 'about',
  label: 'About / Privacy',
  subtitle: 'How AURA encrypts and protects your data',
  icon: InfoIcon,
};

interface AppShellProps {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLock: () => void;
  hasDemo: boolean;
  children: ReactNode;
}

export function AppShell({
  tab,
  onTabChange,
  theme,
  onToggleTheme,
  onLock,
  hasDemo,
  children,
}: AppShellProps) {
  const activeItem = [...PRIMARY_NAV, ABOUT_NAV].find((item) => item.id === tab) ?? PRIMARY_NAV[0];

  return (
    <div className="aura-shell">
      <aside className="aura-sidebar" aria-label="Primary navigation">
        <div className="aura-brand">
          <div className="aura-logo-mark">
            <AuraLogoIcon size={20} />
          </div>
          <div className="aura-brand-text">
            <span className="aura-brand-name">AURA</span>
            <span className="aura-brand-tag">Personal Intelligence</span>
          </div>
        </div>

        <nav className="aura-nav">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`aura-nav-btn ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onTabChange(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="aura-sidebar-footer">
          <button
            type="button"
            className={`aura-nav-btn ${tab === 'about' ? 'active' : ''}`}
            aria-current={tab === 'about' ? 'page' : undefined}
            onClick={() => onTabChange('about')}
          >
            <InfoIcon size={18} />
            <span>About / Privacy</span>
          </button>
          <button type="button" className="aura-nav-btn" onClick={onLock}>
            <LockIcon size={18} />
            <span>Lock vault</span>
          </button>
        </div>
      </aside>

      <div className="aura-main-col">
        <header className="aura-topbar">
          <div className="aura-topbar-left">
            <div>
              <h1 className="aura-page-title">{activeItem.label}</h1>
              <p className="aura-page-sub">{activeItem.subtitle}</p>
            </div>
          </div>

          <div className="aura-topbar-actions">
            <span className="pill primary" title="Data is encrypted on this device with your passphrase">
              Encrypted
            </span>
            <button
              type="button"
              className="btn ghost icon-only"
              onClick={() => onTabChange('about')}
              aria-label="About and Privacy"
              title="About / Privacy"
            >
              <InfoIcon size={18} />
            </button>
            <button
              type="button"
              className="btn ghost icon-only"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            <button type="button" className="btn sm" onClick={onLock}>
              <LockIcon size={15} />
              <span>Lock</span>
            </button>
          </div>
        </header>

        <main className="aura-content">
          {hasDemo && (
            <div className="demo-banner" role="status">
              <div className="row center-v gap-sm wrap">
                <span className="pill demo">DEMO</span>
                <span>Demo data is active. These numbers are sample data, not a real person.</span>
              </div>
              <button type="button" className="btn sm" onClick={() => onTabChange('vault')}>
                Manage in My Data
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

      <nav className="aura-mobile-nav" aria-label="Mobile navigation">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`aura-mobile-nav-btn ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onTabChange(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
