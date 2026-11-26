import { useMemo, useState } from 'react';
import type { DayRecord } from '../types';
import { runInsights } from '../insights/engine';
import { balanceScore } from '../insights/balance';
import { mean } from '../insights/stats';
import { parseCommand, type Command } from '../commands/parse';
import { runCommand } from '../native/bridge';
import { today } from '../lib/dates';

interface Message {
  id: string;
  role: 'user' | 'aura';
  text: string;
  meta?: string;
}

/**
 * Ask AURA: preset questions answered from your own numbers by local code
 * (no LLM in the MVP), plus typed commands that always require a Confirm tap.
 */
export function Ask({ days }: { days: DayRecord[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [cmdText, setCmdText] = useState('');
  const [pending, setPending] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const [cmdResult, setCmdResult] = useState<{ ok: boolean; text: string } | null>(null);

  const questions = useMemo(
    () => [
      {
        q: 'How did I sleep this week?',
        a: () => {
          const s = days
            .slice(-7)
            .map((d) => d.sleepHours)
            .filter((x): x is number => x !== undefined);
          return s.length
            ? {
                text: `Over the last ${s.length} logged night${s.length === 1 ? '' : 's'}, you averaged ${mean(s).toFixed(1)} h of sleep.`,
                meta: `Based on ${s.length} recent day records`,
              }
            : { text: 'I do not have enough sleep data yet.', meta: 'Log sleep in Check-in or load demo data' };
        },
      },
      {
        q: 'What hurts my sleep?',
        a: () => {
          const i = runInsights(days).find((x) => x.id === 'late-screen-sleep');
          return i
            ? {
                text: i.detail,
                meta: i.evidence ? `Based on ${i.evidence.n} days (${i.confidence} confidence)` : 'Not enough data yet',
              }
            : { text: 'I do not have enough data yet.', meta: '14 days needed' };
        },
      },
      {
        q: "What is today's Balance Score?",
        a: () => {
          const latest = days[days.length - 1];
          if (!latest) return { text: 'No data yet.', meta: 'Load demo data or check in first' };
          const b = balanceScore(latest, days.slice(0, -1));
          return {
            text:
              `Your Balance Score for ${latest.date} is ${b.score}/100. ` +
              b.reasons.map((r) => `${r.label} ${r.points}/${r.max}`).join(', ') +
              '.',
            meta: `Calculated for ${latest.date}`,
          };
        },
      },
      {
        q: 'Am I moving enough?',
        a: () => {
          const s = days
            .slice(-7)
            .map((d) => d.steps)
            .filter((x): x is number => x !== undefined);
          return s.length
            ? {
                text: `Over the last ${s.length} day${s.length === 1 ? '' : 's'}, you averaged ${Math.round(mean(s)).toLocaleString()} steps a day.`,
                meta: `Based on ${s.length} recent day records`,
              }
            : { text: 'I do not have step data yet.', meta: 'Import CSV or load demo data' };
        },
      },
    ],
    [days],
  );

  function askQuestion(q: string, answerFn: () => { text: string; meta: string }) {
    const res = answerFn();
    const ts = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `u-${ts}`, role: 'user', text: q },
      { id: `a-${ts}`, role: 'aura', text: res.text, meta: res.meta },
    ]);
  }

  return (
    <section className="stack-lg">
      <div className="card stack-md">
        <div className="row between wrap">
          <div>
            <h2>Ask AURA</h2>
            <p className="xs muted">
              Answers are computed locally from your own encrypted numbers. No external AI model is used.
            </p>
          </div>
          <span className="pill primary">Local insights</span>
        </div>

        <div className="row gap wrap">
          {questions.map((item) => (
            <button
              key={item.q}
              type="button"
              className="btn sm"
              onClick={() => askQuestion(item.q, item.a)}
            >
              {item.q}
            </button>
          ))}
        </div>

        <div className="card-subtle stack-md" style={{ minHeight: 160 }}>
          {messages.length === 0 ? (
            <p className="small muted">
              Choose a suggested question above to inspect your sleep, Balance Score, or movement trends.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-aura'}
              >
                <p className="small">{m.text}</p>
                {m.meta && (
                  <p className="xs muted" style={{ marginTop: 4 }}>
                    {m.meta}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card stack-md">
        <div>
          <h3>Tell AURA to do something</h3>
          <p className="xs muted">
            Supported commands: alarms and calendar events (e.g. &quot;set an alarm for 6:30 am&quot;).
            Every action requires your confirmation first.
          </p>
        </div>

        <form
          className="row gap"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cmdText.trim() || busy) return;
            setCmdResult(null);
            setPending(parseCommand(cmdText, today()));
          }}
        >
          <input
            className="input"
            value={cmdText}
            onChange={(e) => setCmdText(e.target.value)}
            placeholder='Try: "set an alarm for 6:30 am" or "add calendar event walk tomorrow at 7 pm"'
            aria-label="Command input"
          />
          <button type="submit" className="btn primary" disabled={busy || !cmdText.trim()}>
            Preview
          </button>
        </form>

        {pending && (
          <div className="confirm-card stack-sm">
            <p className="small">
              <strong>Please confirm:</strong> {pending.summary}
            </p>
            {pending.type !== 'unknown' ? (
              <div className="row gap">
                <button
                  type="button"
                  className="btn primary sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const res = await runCommand(pending);
                      setCmdResult({ ok: res.ok, text: res.message });
                      setPending(null);
                      if (res.ok) setCmdText('');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Running…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy}
                  onClick={() => setPending(null)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="btn sm" onClick={() => setPending(null)}>
                Dismiss
              </button>
            )}
          </div>
        )}

        {cmdResult && (
          <div className={`status-banner ${cmdResult.ok ? 'ok' : ''}`} role="status">
            {cmdResult.text}
          </div>
        )}
      </div>
    </section>
  );
}
