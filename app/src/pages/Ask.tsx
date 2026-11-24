import { useMemo, useState } from 'react';
import type { DayRecord } from '../types';
import { runInsights } from '../insights/engine';
import { balanceScore } from '../insights/balance';
import { mean } from '../insights/stats';
import { parseCommand, type Command } from '../commands/parse';
import { runCommand } from '../native/bridge';
import { today } from '../lib/dates';

/**
 * Ask AURA: preset questions answered from your own numbers by plain code
 * (no AI model in the MVP), plus typed commands that always need a Confirm tap.
 */
export function Ask({ days }: { days: DayRecord[] }) {
  const [answer, setAnswer] = useState('');
  const [cmdText, setCmdText] = useState('');
  const [pending, setPending] = useState<Command | null>(null);
  const [result, setResult] = useState('');

  const questions = useMemo(
    () => [
      {
        q: 'How did I sleep this week?',
        a: () => {
          const s = days.slice(-7).map((d) => d.sleepHours).filter((x): x is number => x !== undefined);
          return s.length ? `Over the last ${s.length} nights you averaged ${mean(s).toFixed(1)} h of sleep.` : 'I do not have sleep data yet.';
        },
      },
      {
        q: 'What hurts my sleep?',
        a: () => {
          const i = runInsights(days).find((x) => x.id === 'late-screen-sleep');
          return i ? i.detail : 'I do not have enough data yet.';
        },
      },
      {
        q: "What is today's Balance Score?",
        a: () => {
          const latest = days[days.length - 1];
          if (!latest) return 'No data yet.';
          const b = balanceScore(latest, days.slice(0, -1));
          return `Your Balance Score for ${latest.date} is ${b.score}/100. ` + b.reasons.map((r) => `${r.label} ${r.points}/${r.max}`).join(', ') + '.';
        },
      },
      {
        q: 'Am I moving enough?',
        a: () => {
          const s = days.slice(-7).map((d) => d.steps).filter((x): x is number => x !== undefined);
          return s.length ? `Over the last ${s.length} days you averaged ${Math.round(mean(s)).toLocaleString()} steps a day.` : 'I do not have step data yet.';
        },
      },
    ],
    [days],
  );

  return (
    <section>
      <h2>Ask AURA</h2>
      <div className="card">
        <p className="muted small">Answers are worked out from your own numbers by code on this phone. A language model is on the roadmap.</p>
        <div className="row gap wrap">
          {questions.map((x) => (
            <button key={x.q} onClick={() => setAnswer(x.a())}>{x.q}</button>
          ))}
        </div>
        {answer && <p className="answer">{answer}</p>}
      </div>

      <h3>Tell AURA to do something</h3>
      <div className="card">
        <form
          className="row gap"
          onSubmit={(e) => {
            e.preventDefault();
            setResult('');
            setPending(parseCommand(cmdText, today()));
          }}
        >
          <input value={cmdText} onChange={(e) => setCmdText(e.target.value)} placeholder='Try: "set an alarm for 6:30 am"' />
          <button className="primary" disabled={!cmdText.trim()}>Go</button>
        </form>
        {pending && (
          <div className="confirm">
            <p><strong>Please confirm:</strong> {pending.summary}</p>
            {pending.type !== 'unknown' && (
              <div className="row gap">
                <button
                  className="primary"
                  onClick={async () => {
                    setResult((await runCommand(pending)).message);
                    setPending(null);
                  }}
                >
                  Confirm
                </button>
                <button onClick={() => setPending(null)}>Cancel</button>
              </div>
            )}
          </div>
        )}
        {result && <p className="muted">{result}</p>}
      </div>
    </section>
  );
}
