import { useState } from 'react';
import type { Insight } from '../types';
import { ChevronIcon } from './Icons';

interface InsightCardProps {
  insight: Insight;
  rank?: number;
}

export function InsightCard({ insight, rank }: InsightCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <article className={`card stack-sm ${insight.notEnoughData ? 'faded' : ''}`}>
      <div className="row between wrap">
        <div className="row center-v gap-sm">
          {rank !== undefined && !insight.notEnoughData && (
            <span className="pill primary">#{rank}</span>
          )}
          <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>{insight.title}</h4>
        </div>
        <span className={`pill ${insight.notEnoughData ? '' : insight.confidence}`}>
          {insight.notEnoughData ? 'Not enough data yet' : `${insight.confidence} confidence`}
        </span>
      </div>

      <p className="small" style={{ color: 'var(--aura-text)', lineHeight: 1.55 }}>
        {insight.detail}
      </p>

      {insight.suggestion && (
        <div className="suggest-box">
          <strong>Try this:</strong> {insight.suggestion}
        </div>
      )}

      {insight.evidence && (
        <div>
          <button
            type="button"
            className="btn link"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            <span>{open ? 'Hide evidence' : 'Why am I seeing this?'}</span>
            <ChevronIcon size={15} open={open} />
          </button>

          {open && (
            <ul className="evidence-list">
              <li>
                <strong>Days analyzed:</strong> {insight.evidence.n}
              </li>
              <li>
                <strong>Measured effect:</strong> {insight.evidence.effect} {insight.evidence.unit}
              </li>
              {insight.evidence.matched !== undefined && (
                <li>
                  <strong>Pattern frequency:</strong> {insight.evidence.matched} of {insight.evidence.n} days
                </li>
              )}
              {insight.evidence.rho !== undefined && (
                <li>
                  <strong>Rank correlation (Spearman):</strong> {insight.evidence.rho}
                </li>
              )}
              {insight.evidence.p !== undefined && (
                <li>
                  <strong>Permutation-test p-value:</strong> {insight.evidence.p}
                </li>
              )}
              <li className="xs">Computed locally by statistical code on this device, not by an AI model.</li>
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
