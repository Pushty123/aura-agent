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
import { getPhoto, loadProfilePhoto, removeProfilePhoto, saveProfilePhoto } from '../lib/camera';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { useMe } from '../avatar/AvatarContext';
import { saveAvatarChoice, type AvatarChoice } from '../avatar/choice';
import { Avatar } from '../components/Avatar';
import { AVATAR_PRESETS } from '../assets/avatars/presets';
import { WidgetSettings } from '../widget/WidgetSettings';

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
  const [photo, setPhoto] = useState<string | null>(null);
  const me = useMe();
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const saved = await loadProfile();
      if (saved) setP(saved);
      setEmail((await getSession())?.email ?? '');
      setPhoto(await loadProfilePhoto());
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
    await me.reload();
    onSaved?.();
  }

  async function changePhoto(source: 'camera' | 'gallery') {
    try {
      const img = await getPhoto(source);
      if (!img) return;
      await saveProfilePhoto(img);
      setPhoto(img);
      await saveAvatarChoice({ kind: 'photo' });
      await me.reload();
      setStatus({ kind: 'ok', text: 'Photo saved and encrypted on this device.' });
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Could not get the photo.' });
    }
  }

  async function dropPhoto() {
    await removeProfilePhoto();
    setPhoto(null);
    if (me.choice.kind === 'photo') await saveAvatarChoice({ kind: 'preset', id: AVATAR_PRESETS[0].id });
    await me.reload();
  }

  async function pick(c: AvatarChoice) {
    await saveAvatarChoice(c);
    await me.reload();
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  return (
    <section className="stack-lg">
      <div className="grid-2">
        <form className="card stack-md" onSubmit={save}>
          <div className="row center-v gap">
            <AuraAvatar choice={me.choice} photo={photo} name={p.name} size={120} threeD />
            <div className="stack-sm">
              <h2 style={{ margin: 0 }}>{p.name ? p.name : 'Your profile'}</h2>
              {email && <p className="xs muted">{email}</p>}
              <p className="xs muted">Your 3D avatar's face and glow change with your Balance Score. Drag it to turn it around.</p>
            </div>
          </div>

          <div className="stack-sm">
            <strong className="small">Choose your avatar</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 8 }}>
              {AVATAR_PRESETS.map((a) => {
                const active = me.choice.kind === 'preset' && me.choice.id === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => void pick({ kind: 'preset', id: a.id })}
                    aria-pressed={active}
                    aria-label={a.label}
                    title={a.label}
                    style={{
                      background: 'none',
                      border: active ? '2px solid var(--aura-primary)' : '2px solid transparent',
                      borderRadius: '50%',
                      padding: 2,
                      cursor: 'pointer',
                    }}
                  >
                    <Avatar variant={a.id} size={48} ring={false} decorative />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => void pick({ kind: 'initials' })}
                aria-pressed={me.choice.kind === 'initials'}
                title="Initials"
                style={{
                  background: 'none',
                  border: me.choice.kind === 'initials' ? '2px solid var(--aura-primary)' : '2px solid transparent',
                  borderRadius: '50%',
                  padding: 2,
                  cursor: 'pointer',
                }}
              >
                <Avatar variant="initials" size={48} ring={false} name={p.name || 'AURA'} alt="Initials" />
              </button>
            </div>
            <div className="row gap wrap">
              <button type="button" className="btn sm" onClick={() => void changePhoto('camera')}>
                Take photo
              </button>
              <button type="button" className="btn sm ghost" onClick={() => void changePhoto('gallery')}>
                Choose photo
              </button>
              {photo && me.choice.kind !== 'photo' && (
                <button type="button" className="btn sm ghost" onClick={() => void pick({ kind: 'photo' })}>
                  Use my photo
                </button>
              )}
              {photo && (
                <button type="button" className="btn sm ghost" onClick={() => void dropPhoto()}>
                  Remove photo
                </button>
              )}
            </div>
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

          <WidgetSettings />

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
