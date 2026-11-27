import { Settings } from 'lucide-react';

interface ScreenHeaderProps {
  title: string;
  date: string;
  onSettingsClick: () => void;
}

export function ScreenHeader({ title, date, onSettingsClick }: ScreenHeaderProps) {
  return (
    <header className="ds-screen-header">
      <div className="ds-screen-heading">
        <p className="ds-screen-date">{date}</p>
        <h1 className="ds-screen-title">{title}</h1>
      </div>
      <button
        className="ds-settings-button"
        type="button"
        aria-label="Open settings"
        onClick={onSettingsClick}
      >
        <Settings size={22} strokeWidth={1.9} aria-hidden="true" />
      </button>
    </header>
  );
}

export type { ScreenHeaderProps };
