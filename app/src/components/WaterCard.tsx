import { useEffect, useState } from 'react';
import { IconTile, RangeBar } from './design-system';
import { DEFAULT_WATER_SETTINGS, loadWaterSettings, waterProgress, type WaterSettings } from '../reminders/water';
import type { DayRecord } from '../types';

interface WaterCardProps {
  day?: DayRecord;
  onAddGlass: () => void;
  onManage: () => void;
}

export function WaterCard({ day, onAddGlass, onManage }: WaterCardProps) {
  const [settings, setSettings] = useState<WaterSettings>(DEFAULT_WATER_SETTINGS);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void loadWaterSettings().then((saved) => {
      if (active) setSettings(saved);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your water goal.');
    });
    return () => {
      active = false;
    };
  }, []);

  const progress = waterProgress(day, settings);
  const unit = settings.unit === 'glasses' ? 'glasses' : 'ml';
  return (
    <article className="routine-water-card">
      <IconTile kind="water" />
      <div className="routine-water-content">
        <div className="row between center-v gap wrap">
          <div>
            <h2>Water</h2>
            <p className="small muted">
              {progress.current.toLocaleString()} / {progress.goal.toLocaleString()} {unit}
            </p>
          </div>
          <button type="button" className="btn sm" onClick={onAddGlass}>+1 glass</button>
        </div>
        <RangeBar
          min={0}
          max={progress.goal}
          value={progress.current}
          label={`Water progress: ${progress.current} of ${progress.goal} ${unit}`}
        />
        <div className="row between center-v gap wrap">
          <span className="xs muted">{progress.percent}% of your personal goal</span>
          <button type="button" className="btn sm ghost" onClick={onManage}>Goal & reminders</button>
        </div>
        {error && <p className="xs error-text" role="alert">{error}</p>}
      </div>
    </article>
  );
}
