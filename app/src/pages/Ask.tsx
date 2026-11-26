import { useEffect, useMemo, useState } from 'react';
import type { DayRecord } from '../types';
import { runInsights } from '../insights/engine';
import { balanceScore } from '../insights/balance';
import { mean } from '../insights/stats';
import { parseCommand, type Command } from '../commands/parse';
import { runCommand } from '../native/bridge';
import { today } from '../lib/dates';
import { askSmart, buildContext, getAiConsent, setAiConsent, smartStatus, type Turn } from '../lib/ai';
import { getSession } from '../lib/account';
import { loadProfile, type Profile } from '../profile/profile';
import { loadWorkouts, type Workout } from '../exercise/workouts';

interface Message {
  id: string;
  role: 'user' | 'aura';
  text: string;
  meta?: string;
}

/**
 * Ask AURA: a chat box. With "Smart replies" on (opt-in) a language model on the
 * AURA server answers from a short summary of your patterns. With it off, or
 * offline, preset questions are answered by local code. Typed commands always
 * require a Confirm tap.
 */
export function Ask({ days }: { days: DayRecord[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [cmdText, setCmdText] = useState('');
  const [pending, setPending] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const [cmdResult, setCmdResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [smartOn, setSmartOn] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    void (async () => {
      setSmartOn(await getAiConsent());
      setLoggedIn(!!(await getSession()));
      setProfile((await loadProfile()) ?? null);
      setWorkouts(await loadWorkouts());
      setServerReady(await smartStatus());
    })();
  }, []);

  const context = useMemo(() => buildContext(days, profile, workouts), [days, profile, workouts]);
  const smartActive = smartOn && serverReady && loggedIn;

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

  function addMessages(...m: Message[]) {
    setMessages((prev) => [...prev, ...m]);
  }

  function localAnswer(q: string) {
    const lower = q.toLowerCase();
    const hit =
      questions.find((x) => x.q.toLowerCase() === lower) ??
      (/sleep|slept|bed/.test(lower) && /hurt|affect|bad|why|cause/.test(lower)
        ? questions[1]
        : /sleep|slept/.test(lower)
          ? questions[0]
          : /balance|score/.test(lower)
            ? questions[2]
            : /step|move|walk|active/.test(lower)
              ? questions[3]
              : null);
    return hit ? hit.a() : null;
  }

  async function send(q: string) {
    const question = q.trim();
    if (!question || thinking) return;
    setText('');
    const ts = Date.now();
    const userMsg: Message = { id: `u-${ts}`, role: 'user', text: question };

    // Typed actions always go through the Confirm card, never straight to a model.
    const cmd = parseCommand(question, today());
    if (cmd.type !== 'unknown') {
      addMessages(userMsg, { id: `a-${ts}`, role: 'aura', text: 'I can do that. Please check the details and confirm below.' });
      setCmdResult(null);
      setPending(cmd);
      return;
    }

    if (smartActive) {
      addMessages(userMsg);
      setThinking(true);
      try {
        const history: Turn[] = messages
          .filter((m) => !m.meta?.startsWith('Built-in'))
          .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
        const reply = await askSmart(question, history, context);
        addMessages({ id: `a-${ts}`, role: 'aura', text: reply, meta: 'Smart reply · from a summary of your recent patterns' });
      } catch (e) {
        const fallback = localAnswer(question);
        addMessages({
          id: `a-${ts}`,
          role: 'aura',
          text: `${e instanceof Error ? e.message : 'Smart replies are unavailable.'}${fallback ? ` Here is the built-in answer: ${fallback.text}` : ''}`,
          meta: 'Built-in answer',
        });
      } finally {
        setThinking(false);
      }
      return;
    }

    const res = localAnswer(question);
    addMessages(userMsg, {
      id: `a-${ts}`,
      role: 'aura',
      text: res
        ? res.text
        : 'I can answer sleep, movement and Balance Score questions from your numbers. Turn on Smart replies above to chat about anything in your patterns.',
      meta: res ? `Built-in answer · ${res.meta}` : 'Built-in answer',
    });
  }

  async function toggleSmart(on: boolean) {
    await setAiConsent(on);
    setSmartOn(on);
  }

  return (
    <section className="stack-lg">
      <div className="card stack-md">
        <div className="row between wrap">
          <div>
            <h2>Ask AURA</h2>
            <p className="xs muted">
              {smartActive
                ? 'Smart replies are on: a language model answers from a short summary of your patterns. Your name, email and raw records are never sent.'
                : 'Answers are computed on this phone from your own encrypted numbers.'}
            </p>
          </div>
          <span className={`pill ${smartActive ? 'primary' : ''}`}>{smartActive ? 'Smart replies' : 'Local insights'}</span>
        </div>

        <div className="card-subtle stack-sm">
          <label className="row gap center-v">
            <input
              type="checkbox"
              checked={smartOn}
              onChange={(e) => void toggleSmart(e.target.checked)}
              aria-label="Use smart replies"
            />
            <strong className="small">Use smart replies (optional)</strong>
          </label>
          <p className="xs muted">
            Lets you chat in your own words. When on, a short summary of your recent patterns is sent through the AURA
            server to a language model. Every request appears in My Data → network ledger.
          </p>
          {smartOn && !loggedIn && <p className="xs">Log in to your account to use smart replies.</p>}
          {smartOn && loggedIn && !serverReady && (
            <p className="xs">Smart replies are not available from the server right now, so built-in answers are used.</p>
          )}
          <details>
            <summary className="xs">See exactly what would be sent</summary>
            <pre className="xs" style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{context}</pre>
          </details>
        </div>

        <div className="row gap wrap">
          {questions.map((item) => (
            <button key={item.q} type="button" className="btn sm" disabled={thinking} onClick={() => void send(item.q)}>
              {item.q}
            </button>
          ))}
        </div>

        <div className="card-subtle stack-md" style={{ minHeight: 160 }} aria-live="polite">
          {messages.length === 0 ? (
            <p className="small muted">
              Ask a question below or tap a suggestion to inspect your sleep, Balance Score or movement.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-aura'}>
                <p className="small">{m.text}</p>
                {m.meta && (
                  <p className="xs muted" style={{ marginTop: 4 }}>
                    {m.meta}
                  </p>
                )}
              </div>
            ))
          )}
          {thinking && <p className="xs muted">AURA is thinking…</p>}
        </div>

        <form
          className="row gap"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={smartActive ? 'Ask anything about your patterns…' : 'Ask about sleep, steps or your Balance Score…'}
            aria-label="Message to AURA"
            maxLength={500}
          />
          <button type="submit" className="btn primary" disabled={thinking || !text.trim()}>
            Send
          </button>
        </form>
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
