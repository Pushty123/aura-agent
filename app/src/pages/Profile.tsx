import { useEffect, useState } from 'react';
import {
  BLOOD_GROUPS,
  computeTargets,
  loadProfile,
  saveProfile,
  validateProfile,
  type Activity,
  type BloodGroup,
  type GoalKind,
  type Profile as ProfileData,
  type Sex,
} from '../profile/profile';
import { getSession } from '../lib/account';

const EMPTY: ProfileData = {
  name: '',
  age: 0,
  sex: 'female',
  heightCm: 0,
  weightKg: 0,
  bloodGroup: 'Unknown',
  allergies: '',
  activity: 'light',
  goal: 'maintain',
  updatedAt: 0,
};

const num = (v: string) => (v === '' ? 0 : Number(v));

export function Profile({ onSaved }: { onSaved?: () => void }) {
  const [p, setP] = useState<ProfileData>(EMPTY);
  const [email, setEmail] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const saved = await loadProfile();
      if (saved) setP(saved);
      setEmail((await getSession())?.email ?? '');
      setLoaded(true);
    })();
  }, []);

  const complete = !validateProfile(p);
  const targets = complete ? computeTargets(p) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const err = validateProfile(p);
    if (err) {
      setStatus({ kind: 'error', text: err });
      return;
    }
    await saveProfile(p);
    setStatus({ kind: 'ok', text: 'Profile saved and encrypted on this device.' });
    onSaved?.();
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  return (
    <section className="stack-lg">
      <div className="grid-2">
        <form className="card stack-md" onSubmit={save}>
          <div>
            <h2 style={{ margin: 0 }}>{p.name ? p.name : 'Your profile'}</h2>
            {email && <p className="xs muted">{email}</p>}
          </div>

          <div className="stack-sm">
            <label className="small" htmlFor="pf-name" style={{ fontWeight: 600 }}>
              Name
            </label>
            <input id="pf-name" className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </div>

          <div className="grid-2">
            <div className="stack-sm">
              <label className="small" htmlFor="pf-age" style={{ fontWeight: 600 }}>
                Age
              </label>
              <input
                id="pf-age"
                className="input"
                type="number"
                inputMode="numeric"
                value={p.age || ''}
                onChange={(e) => setP({ ...p, age: num(e.target.value) })}
              />
            </div>
            <div className="stack-sm">
              <label className="small" htmlFor="pf-sex" style={{ fontWeight: 600 }}>
                Sex
              </label>
              <select id="pf-sex" className="input" value={p.sex} onChange={(e) => setP({ ...p, sex: e.target.value as Sex })}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="stack-sm">
              <label className="small" htmlFor="pf-h" style={{ fontWeight: 600 }}>
                Height (cm)
              </label>
              <input
                id="pf-h"
                className="input"
                type="number"
                inputMode="decimal"
                value={p.heightCm || ''}
                onChange={(e) => setP({ ...p, heightCm: num(e.target.value) })}
              />
            </div>
            <div className="stack-sm">
              <label className="small" htmlFor="pf-w" style={{ fontWeight: 600 }}>
                Weight (kg)
              </label>
              <input
                id="pf-w"
                className="input"
                type="number"
                inputMode="decimal"
                value={p.weightKg || ''}
                onChange={(e) => setP({ ...p, weightKg: num(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="stack-sm">
              <label className="small" htmlFor="pf-bg" style={{ fontWeight: 600 }}>
                Blood group
              </label>
              <select
                id="pf-bg"
                className="input"
                value={p.bloodGroup}
                onChange={(e) => setP({ ...p, bloodGroup: e.target.value as BloodGroup })}
              >
                {BLOOD_GROUPS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="stack-sm">
              <label className="small" htmlFor="pf-act" style={{ fontWeight: 600 }}>
                Activity level
              </label>
              <select
                id="pf-act"
                className="input"
                value={p.activity}
                onChange={(e) => setP({ ...p, activity: e.target.value as Activity })}
              >
                <option value="low">Mostly sitting</option>
                <option value="light">Light (1–3 workouts a week)</option>
                <option value="moderate">Moderate (3–5 a week)</option>
                <option value="high">High (6–7 a week)</option>
              </select>
            </div>
          </div>

          <div className="stack-sm">
            <label className="small" htmlFor="pf-goal" style={{ fontWeight: 600 }}>
              Goal
            </label>
            <select id="pf-goal" className="input" value={p.goal} onChange={(e) => setP({ ...p, goal: e.target.value as GoalKind })}>
              <option value="lose">Lose weight gently</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain weight gently</option>
            </select>
          </div>

          <div className="stack-sm">
            <label className="small" htmlFor="pf-all" style={{ fontWeight: 600 }}>
              Allergies (optional)
            </label>
            <input
              id="pf-all"
              className="input"
              placeholder="e.g. peanuts, penicillin"
              value={p.allergies}
              onChange={(e) => setP({ ...p, allergies: e.target.value })}
            />
          </div>

          {status && (
            <div className={`status-banner ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
              {status.text}
            </div>
          )}

          <button type="submit" className="btn primary">
            Save profile
          </button>
          <p className="xs muted">Stored encrypted in your vault. It only leaves this device if you choose to back up, and then only as ciphertext.</p>
        </form>

        <div className="stack-lg">
          <article className="card stack-sm">
            <h3 style={{ margin: 0 }}>Your numbers</h3>
            {targets ? (
              <>
                <div className="row between">
                  <span className="muted">BMI</span>
                  <strong>
                    {targets.bmi} <span className="xs muted">({targets.bmiBand})</span>
                  </strong>
                </div>
                <div className="row between">
                  <span className="muted">Resting energy</span>
                  <strong>{targets.bmr} kcal</strong>
                </div>
                <div className="row between">
                  <span className="muted">Daily target</span>
                  <strong>~{targets.kcal} kcal</strong>
                </div>
                <div className="row between">
                  <span className="muted">Protein target</span>
                  <strong>~{targets.proteinG} g</strong>
                </div>
                <p className="xs muted">
                  Approximate wellness estimates from a standard formula. Not medical advice; check with a doctor
                  or dietitian for personal needs.
                </p>
              </>
            ) : (
              <p className="small muted">Fill in age, height and weight to see your BMI and daily targets.</p>
            )}
          </article>

          {p.bloodGroup !== 'Unknown' || p.allergies ? (
            <article className="card stack-sm">
              <h3 style={{ margin: 0 }}>Health card</h3>
              <div className="row gap wrap">
                {p.bloodGroup !== 'Unknown' && <span className="pill primary">Blood group {p.bloodGroup}</span>}
                {p.allergies && <span className="pill">Allergies: {p.allergies}</span>}
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
