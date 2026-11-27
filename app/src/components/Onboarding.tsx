import { useState } from 'react';
import { BellRing, ChevronRight, LineChart, ShieldCheck } from 'lucide-react';

const SLIDES = [
  {
    icon: LineChart,
    title: 'Your health, in one place',
    text: 'Sleep, steps, screen time, food and mood from your phone and band, brought together in one simple daily score.',
  },
  {
    icon: BellRing,
    title: 'Nudges that fit your day',
    text: 'Plans for exams or fitness, gentle reminders and app limits, built from your own patterns.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    text: 'Everything is encrypted on your phone. You decide what is shared, and you can delete it anytime.',
  },
];

/** Three intro slides shown once, before sign-up, like most apps. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div className="onboard">
      <div className="onboard-top">
        <span className="onboard-brand">AURA</span>
        {!last && (
          <button type="button" className="btn ghost sm" onClick={onDone}>
            Skip
          </button>
        )}
      </div>
      <div className="onboard-body" key={i}>
        <div className="onboard-art" aria-hidden="true">
          <s.icon size={56} strokeWidth={1.5} />
        </div>
        <h1>{s.title}</h1>
        <p>{s.text}</p>
      </div>
      <div className="onboard-foot">
        <div className="onboard-dots" role="tablist" aria-label="Intro pages">
          {SLIDES.map((x, k) => (
            <button key={x.title} type="button" role="tab" aria-selected={k === i} aria-label={`Page ${k + 1}`} className={k === i ? 'on' : ''} onClick={() => setI(k)} />
          ))}
        </div>
        <button type="button" className="btn primary onboard-next" onClick={() => (last ? onDone() : setI(i + 1))}>
          {last ? 'Get started' : 'Next'} <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
