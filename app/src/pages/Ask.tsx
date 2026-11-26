import { detectSymptom, GUIDES, loadHealth, newEntry, personalNotes, recentCounts, saveHealth, type SymptomId } from '../health/symptoms';
import { getAutoSpeak, listen, setAutoSpeak, speak, stopSpeaking, voiceIssue, type Listener } from '../voice/voice';
import { localReply } from '../ask/localBrain';
import { useMe } from '../avatar/AvatarContext';
import { loadFood } from '../lib/store';
import type { FoodEntry } from '../types';
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
  /** A symptom AURA recognised, so it can be saved to the health log. */
  symptom?: SymptomId;
  saved?: boolean;
}

/**
 * Ask AURA: a chat box. With "Smart replies" on (opt-in) a language model on the
 * AURA server answers from a short summary of your patterns. With it off, or
 * offline, preset questions are answered by local code. Typed commands always
 * require a Confirm tap.
 */
export function Ask({ days }: { days: DayRecord[] }) {
  const [symptoms, setSymptoms] = useState<{ label: string; n: number }[]>([]);
  const [food, setFood] = useState<FoodEntry[]>([]);
  const [autoSpeak, setAuto] = useState(false);
  const [listener, setListener] = useState<Listener | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const { choice } = useMe();
  const characterId = choice?.kind === 'character' ? choice.id : undefined;
  const [messages, setMessages] = useState<Message[]>([]);
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
      setFood(await loadFood());
      setAuto(await getAutoSpeak());
      setSymptoms(recentCounts(await loadHealth(), today()));
      setServerReady(await smartStatus());
    })();
  }, []);

  const context = useMemo(() => buildContext(days, profile, workouts, symptoms), [days, profile, workouts, symptoms]);
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
    return hit ? hit.a() : localReply(q, days, food, today());
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

    const symptom = detectSymptom(question, profile?.sex === 'female');
    if (symptom) {
      const g = GUIDES[symptom];
      const mine = personalNotes(symptom, days, food, today());
      const reply =
        `Sorry you're dealing with ${g.label.toLowerCase()}. ` +
        (mine.length ? `${mine.join(' ')} ` : '') +
        `What may help: ${g.food.slice(0, 2).join('; ')}. Also: ${g.care.slice(0, 2).join('; ')}. ` +
        `See a doctor if: ${g.redFlags.slice(0, 2).join('; ')}.`;
      addMessages(userMsg, { id: `a-${ts}`, role: 'aura', text: reply, meta: 'Built-in health guide · general wellness information, not medical advice', symptom });
      void maybeSpeak(`a-${ts}`, reply);
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
        void maybeSpeak(`a-${ts}`, reply);
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
    if (res) void maybeSpeak(`a-${ts}`, res.text);
    addMessages(userMsg, {
      id: `a-${ts}`,
      role: 'aura',
      text: res
        ? res.text
        : `I can answer questions about your sleep, steps, screen time, water, mood, food, streaks and this week. ${loggedIn ? 'Switch on smart replies above to chat about anything.' : 'Log in (☰ menu) and switch on smart replies to chat about anything.'}`,
      meta: res ? `Built-in answer · ${res.meta}` : 'Built-in answer',
    });
  }

  async function say(id: string, t: string) {
    if (speaking === id) {
      await stopSpeaking();
      setSpeaking(null);
      return;
    }
    setSpeaking(id);
    setVoiceMsg(null);
    try {
      const used = await speak(t, characterId);
      setVoiceMsg(used === 'phone' ? voiceIssue() : null);
    } catch (e) {
      setVoiceMsg(e instanceof Error ? e.message : 'Could not speak.');
    }
    setSpeaking((cur) => (cur === id ? null : cur));
  }

  async function maybeSpeak(id: string, t: string) {
    if (await getAutoSpeak()) await say(id, t);
  }

  async function mic() {
    if (listener) {
      listener.stop();
      return;
    }
    setVoiceMsg(null);
    try {
      const l = await listen();
      setListener(l);
      const heard = (await l.result).trim();
      setListener(null);
      if (heard) await send(heard);
      else setVoiceMsg("I didn't catch that. Try again.");
    } catch (e) {
      setListener(null);
      setVoiceMsg(e instanceof Error ? e.message : 'Could not use the microphone.');
    }
  }

  async function saveSymptom(m: Message) {
    if (!m.symptom) return;
    const q = messages[messages.findIndex((x) => x.id === m.id) - 1]?.text ?? '';
    await saveHealth(newEntry(today(), m.symptom, 2, q));
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, saved: true } : x)));
    setSymptoms(recentCounts(await loadHealth(), today()));
  }

  async function toggleSmart(on: boolean) {
    await setAiConsent(on);
    setSmartOn(on);
    if (on) {
      // Check again now: the server or login may have changed since the screen opened.
      setLoggedIn(!!(await getSession()));
      setServerReady(await smartStatus());
    }
  }

  return (
    <section className="ask-page">
      <div className="card ask-head">
        <div className="row between center-v gap">
          <div className="row gap center-v">
            <span className="ask-dot" data-on={smartActive} aria-hidden="true" />
            <div>
              <strong>{smartActive ? 'Smart replies on' : 'Answers from your phone'}</strong>
              <p className="xs muted" style={{ margin: 0 }}>
                {smartActive ? 'AI reads a short summary, never your raw data' : 'Turn on AI to chat about anything'}
              </p>
            </div>
          </div>
          <label className="switch" aria-label="Use smart replies">
            <input type="checkbox" checked={smartOn} onChange={(e) => void toggleSmart(e.target.checked)} />
            <span />
          </label>
        </div>
        {smartOn && !loggedIn && <p className="xs">Log in (☰ menu) to use smart replies.</p>}
        {smartOn && loggedIn && !serverReady && <p className="xs">The AI server isn&apos;t reachable right now, so built-in answers are used.</p>}
        <details>
          <summary className="xs muted">What is shared?</summary>
          <pre className="xs" style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{context}</pre>
        </details>
      </div>

      <div className="ask-chat" aria-live="polite">
        {messages.length === 0 && (
          <div className="ask-empty">
            <p className="small muted">Ask anything about your sleep, steps, mood or screen time, tell AURA how you feel (&quot;I have a headache&quot;), or give a command (&quot;set an alarm for 6:30 am&quot;). Tap 🎤 to talk.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-aura'}>
            <p className="small">{m.text}</p>
            {m.role === 'aura' && (
              <div className="row gap wrap" style={{ marginTop: 6 }}>
                <button type="button" className="btn sm ghost" onClick={() => void say(m.id, m.text)} aria-label={speaking === m.id ? 'Stop speaking' : 'Read aloud'}>
                  {speaking === m.id ? '⏹ Stop' : '🔊'}
                </button>
                {m.symptom && (
                  <button type="button" className="btn sm" disabled={m.saved} onClick={() => void saveSymptom(m)}>
                    {m.saved ? '✓ Saved to health log' : '➕ Save to health log'}
                  </button>
                )}
              </div>
            )}
            {m.meta && <p className="xs muted" style={{ marginTop: 4 }}>{m.meta}</p>}
          </div>
        ))}
        {thinking && <p className="xs muted">AURA is thinking…</p>}
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

      <div className="ask-chips">
        {questions.map((item) => (
          <button key={item.q} type="button" className="pill" disabled={thinking} onClick={() => void send(item.q)}>
            {item.q}
          </button>
        ))}
      </div>

      <form
        className="ask-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <button
          type="button"
          className={`btn icon-only ${listener ? 'primary' : ''}`}
          onClick={() => void mic()}
          disabled={thinking}
          aria-label={listener ? 'Stop listening' : 'Talk to AURA'}
        >
          {listener ? '⏹' : '🎤'}
        </button>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listener ? 'Listening… tap ⏹ when done' : 'Message AURA…'}
          aria-label="Message to AURA"
          maxLength={500}
        />
        <button type="submit" className="btn primary" disabled={thinking || !text.trim()}>
          Send
        </button>
      </form>
      <div className="row between center-v xs" style={{ padding: '0 4px' }}>
        <label className="row gap center-v">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(e) => {
              setAuto(e.target.checked);
              void setAutoSpeak(e.target.checked);
              if (!e.target.checked) void stopSpeaking();
            }}
          />
          🔊 Read replies aloud
        </label>
        {voiceMsg && <span className="muted">{voiceMsg}</span>}
      </div>
    </section>
  );
}
