import { Activity, Heart, House, Moon } from 'lucide-react';
import { useState } from 'react';
import type { ThemeMode } from '../components/AppShell';
import {
  BottomTabBar,
  IconTile,
  MetricCard,
  RangeBar,
  ScreenHeader,
  type BottomTab,
  type MetricKind,
} from '../components/design-system';

interface DesignProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const METRICS: {
  kind: MetricKind;
  label: string;
  value: string;
  unit: string;
  timestamp: string;
  range?: { min: number; max: number; value: number; label: string };
}[] = [
  { kind: 'heart', label: 'Heart rate', value: '72', unit: 'bpm', timestamp: 'Updated 9:41 AM', range: { min: 40, max: 180, value: 72, label: 'Heart rate range' } },
  { kind: 'exercise', label: 'Exercise', value: '38', unit: 'min', timestamp: 'Updated 8:12 AM' },
  { kind: 'blood-pressure', label: 'Blood pressure', value: '118/76', unit: 'mmHg', timestamp: 'Updated 8:02 AM', range: { min: 80, max: 180, value: 118, label: 'Systolic blood pressure range' } },
  { kind: 'sleep', label: 'Sleep', value: '7.8', unit: 'hrs', timestamp: 'Last night · 7:04 AM', range: { min: 0, max: 12, value: 7.8, label: 'Sleep duration range' } },
  { kind: 'steps', label: 'Steps', value: '8,420', unit: 'steps', timestamp: 'Updated 9:35 AM', range: { min: 0, max: 12000, value: 8420, label: 'Steps range' } },
  { kind: 'water', label: 'Water', value: '6', unit: 'glasses', timestamp: 'Updated 9:20 AM' },
  { kind: 'mood', label: 'Mood', value: 'Good', unit: '', timestamp: 'Checked in 8:30 AM' },
  { kind: 'food', label: 'Food', value: '1,240', unit: 'kcal', timestamp: 'Updated 12:15 PM' },
];

const TABS: BottomTab[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'heart', label: 'Health', icon: Heart },
  { id: 'sleep', label: 'Sleep', icon: Moon },
];

const ACCENT_TOKENS: { name: string; kind: MetricKind }[] = [
  { name: 'Heart · red', kind: 'heart' },
  { name: 'Exercise · orange', kind: 'exercise' },
  { name: 'Blood pressure · blue', kind: 'blood-pressure' },
  { name: 'Sleep · purple', kind: 'sleep' },
  { name: 'Steps · green', kind: 'steps' },
  { name: 'Water · cyan', kind: 'water' },
  { name: 'Mood · pink', kind: 'mood' },
  { name: 'Food · amber', kind: 'food' },
];

export function Design({ theme, onToggleTheme }: DesignProps) {
  const [activeTab, setActiveTab] = useState('home');
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <main className="ds-demo-page">
      <ScreenHeader
        date={date}
        title="Design system"
        onSettingsClick={onToggleTheme}
      />

      <div className="ds-demo-banner">
        <span className="ds-demo-badge">DEMO</span>
        <span>Sample content only · {theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'} theme</span>
        <button type="button" className="ds-theme-toggle" onClick={onToggleTheme}>
          Switch to {document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'}
        </button>
      </div>

      <section className="ds-demo-section" aria-labelledby="ds-token-title">
        <h2 id="ds-token-title" className="ds-demo-section-title">Theme tokens</h2>
        <p className="ds-demo-description">Semantic colors, rounded geometry, soft elevation, and system typography.</p>
        <div className="ds-token-swatches">
          {ACCENT_TOKENS.map(({ name, kind }) => (
            <div className="ds-token-swatch" key={kind}>
              <IconTile kind={kind} size={18} />
              <span>{name}</span>
            </div>
          ))}
        </div>
        <div className="ds-token-samples">
          <div><span>Radius</span><strong>20px</strong></div>
          <div><span>Card shadow</span><strong>Soft elevation</strong></div>
          <div><span>Spacing</span><strong>8 · 16 · 24px</strong></div>
          <div><span>Typography</span><strong>System sans-serif</strong></div>
        </div>
      </section>

      <section className="ds-demo-section" aria-labelledby="ds-components-title">
        <h2 id="ds-components-title" className="ds-demo-section-title">Metric cards <span className="ds-demo-badge">DEMO</span></h2>
        <p className="ds-demo-description">All metric accents, overlapping icon tiles, values, timestamps, and range indicators.</p>
        <div className="ds-metric-grid">
          {METRICS.map((metric) => <MetricCard key={metric.kind} {...metric} />)}
        </div>
      </section>

      <section className="ds-demo-section" aria-labelledby="ds-primitives-title">
        <h2 id="ds-primitives-title" className="ds-demo-section-title">Component samples <span className="ds-demo-badge">DEMO</span></h2>
        <div className="ds-primitives">
          <div className="ds-primitive-card">
            <h3>Icon tile</h3>
            <div className="ds-primitive-icons">
              <IconTile kind="heart" />
              <IconTile kind="exercise" />
              <IconTile kind="blood-pressure" />
              <IconTile kind="sleep" />
              <IconTile kind="steps" />
              <IconTile kind="water" />
              <IconTile kind="mood" />
              <IconTile kind="food" />
            </div>
          </div>
          <div className="ds-primitive-card">
            <h3>Range bar</h3>
            <p className="ds-demo-description">Example range · 72 of 100</p>
            <RangeBar min={0} max={100} value={72} label="Demo range bar" />
          </div>
        </div>
      </section>

      <section className="ds-demo-section ds-tab-demo" aria-labelledby="ds-tabs-title">
        <h2 id="ds-tabs-title" className="ds-demo-section-title">Bottom tab bar <span className="ds-demo-badge">DEMO</span></h2>
        <p className="ds-demo-description">Four touch-friendly destinations; the active tab uses the theme accent.</p>
        <BottomTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </section>
    </main>
  );
}
