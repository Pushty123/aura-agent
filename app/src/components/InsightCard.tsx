import { useState } from 'react';
import type { Insight } from '../types';

export function InsightCard({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`card insight ${insight.notEnoughData ? 'faded' : ''}`}>
      <div className="row between">
        <strong>{insight.title}</strong>
        <span className={`pill ${insight.confidence}`}>{insight.notEnoughData ? 'not enough data' : `${insight.confidence} confidence`}</span>
      </div>
      <p>{insight.detail}</p>
      {insight.suggestion && <p className="suggest">Try this: {insight.suggestion}</p>}
      {insight.evidence && (
        <>
          <button className="link" onClick={() => setOpen(!open)}>
            {open ? 'Hide evidence' : 'Why am I seeing this?'}
          </button>
          {open && (
            <ul className="evidence">
              <li>Days used: {insight.evidence.n}</li>
              <li>
                Effect: {insight.evidence.effect} {insight.evidence.unit}
              </li>
              {insight.evidence.rho !== undefined && <li>Rank correlation (Spearman): {insight.evidence.rho}</li>}
              {insight.evidence.p !== undefined && <li>Permutation-test p-value: {insight.evidence.p}</li>}
              <li className="muted">Computed by plain code on this phone, not by an AI model.</li>
            </ul>
          )}
        </>
      )}
    </div>
  );
}
