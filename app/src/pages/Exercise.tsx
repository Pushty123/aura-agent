import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pose, Results } from '@mediapipe/pose';
import { createPose } from '../exercise/pose';
import { EXERCISES, POSE_LINES, RepCounter, type ExerciseId } from '../exercise/reps';
import { loadWorkouts, saveWorkout, type Workout } from '../exercise/workouts';
import { today } from '../lib/dates';
import { Capacitor } from '@capacitor/core';

type Phase = 'idle' | 'loading' | 'running';

export function Exercise() {
  const [exercise, setExercise] = useState<ExerciseId>('squat');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [phase, setPhase] = useState<Phase>('idle');
  const [reps, setReps] = useState(0);
  const [inView, setInView] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [history, setHistory] = useState<Workout[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const counterRef = useRef<RepCounter | null>(null);
  const runningRef = useRef(false);
  const startedAt = useRef(0);

  const refreshHistory = useCallback(async () => setHistory((await loadWorkouts()).slice(0, 8)), []);
  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const teardown = useCallback(() => {
    runningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void poseRef.current?.close();
    poseRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  // Elapsed timer
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [phase]);

  function draw(results: Results) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lm = results.poseLandmarks;
    if (!lm) return;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#3dd6a3';
    for (const [a, b] of POSE_LINES) {
      if ((lm[a].visibility ?? 0) < 0.5 || (lm[b].visibility ?? 0) < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
      ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
      if ((lm[i].visibility ?? 0) < 0.5) continue;
      ctx.beginPath();
      ctx.arc(lm[i].x * canvas.width, lm[i].y * canvas.height, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  async function start() {
    setError('');
    setSaved('');
    setReps(0);
    setSeconds(0);
    setPhase('loading');
    try {
      if (Capacitor.isNativePlatform()) {
        // Ask Android for camera access first; the in-app camera view needs it.
        const { Camera } = await import('@capacitor/camera');
        const perm = await Camera.requestPermissions({ permissions: ['camera'] });
        if (perm.camera !== 'granted' && perm.camera !== 'limited') throw new Error('Permission denied');
      }
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          window.isSecureContext
            ? 'This browser does not allow the camera here. Try Chrome.'
            : 'The camera only works on a secure (https) page or in the Android app.',
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const pose = await createPose();
      poseRef.current = pose;
      const counter = new RepCounter(exercise);
      counterRef.current = counter;
      pose.onResults((results) => {
        draw(results);
        const s = counter.update(results.poseLandmarks, performance.now());
        setReps((r) => (r === s.reps ? r : s.reps));
        setInView((v) => (v === s.inView ? v : s.inView));
      });

      runningRef.current = true;
      startedAt.current = Date.now();
      setPhase('running');
      const loop = async () => {
        if (!runningRef.current) return;
        if (video.readyState >= 2) await poseRef.current?.send({ image: video });
        if (runningRef.current) requestAnimationFrame(() => void loop());
      };
      void loop();
    } catch (e) {
      teardown();
      setPhase('idle');
      const msg = e instanceof Error ? e.message : '';
      setError(
        /denied|NotAllowed|Permission/i.test(msg)
          ? 'Camera permission was denied. Allow it in phone Settings → Apps → AURA → Permissions.'
          : msg || 'Could not start the camera.',
      );
    }
  }

  async function stop() {
    const secs = Math.round((Date.now() - startedAt.current) / 1000);
    const count = counterRef.current?.state.reps ?? 0;
    teardown();
    setPhase('idle');
    if (count > 0) {
      await saveWorkout({ date: today(), exercise, reps: count, seconds: secs });
      setSaved(`Saved ${count} ${EXERCISES[exercise].label.toLowerCase()} in ${secs}s.`);
      await refreshHistory();
    } else {
      setSaved('No reps counted, so nothing was saved.');
    }
  }

  const spec = EXERCISES[exercise];
  const running = phase === 'running';
  const mirror = facing === 'user' ? 'scaleX(-1)' : 'none';
  const todayTotal = history.filter((w) => w.date === today()).reduce((s, w) => s + w.reps, 0);

  return (
    <section className="stack-lg">
      <div className="grid-2">
        <article className="card stack-md">
          <div className="row gap wrap">
            {(Object.keys(EXERCISES) as ExerciseId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`btn ${exercise === id ? 'primary' : ''}`}
                disabled={phase !== 'idle'}
                onClick={() => setExercise(id)}
              >
                {EXERCISES[id].label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '4 / 3' }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: mirror, display: running || phase === 'loading' ? 'block' : 'none' }}
            />
            <canvas
              ref={canvasRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: mirror, pointerEvents: 'none' }}
            />
            {!running && (
              <div className="center" style={{ position: 'absolute', inset: 0, color: '#fff', padding: 16, textAlign: 'center' }}>
                {phase === 'loading' ? 'Starting camera and loading the on-device model…' : spec.hint}
              </div>
            )}
          </div>

          {running && !inView && (
            <div className="status-banner error" role="status">
              Step back so your whole body is in view.
            </div>
          )}
          {error && (
            <div className="status-banner error" role="alert">
              {error}
            </div>
          )}
          {saved && (
            <div className="status-banner ok" role="status">
              {saved}
            </div>
          )}

          <div className="row gap wrap">
            {!running ? (
              <button type="button" className="btn primary" onClick={() => void start()} disabled={phase === 'loading'}>
                {phase === 'loading' ? 'Starting…' : 'Start camera'}
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={() => void stop()}>
                Finish and save
              </button>
            )}
            <button
              type="button"
              className="btn ghost"
              disabled={phase !== 'idle'}
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            >
              {facing === 'user' ? 'Using front camera' : 'Using back camera'}
            </button>
          </div>
          <p className="xs muted">
            Video is analysed on this phone and is never saved or sent anywhere. Only your rep count is stored,
            encrypted.
          </p>
        </article>

        <div className="stack-lg">
          <article className="card stack-sm" aria-live="polite">
            <p className="xs muted">{spec.label}</p>
            <div style={{ fontSize: '4rem', fontWeight: 700, lineHeight: 1 }}>{reps}</div>
            <p className="small muted">reps · {seconds}s</p>
          </article>

          <article className="card stack-sm">
            <h3 style={{ margin: 0 }}>Recent workouts</h3>
            {todayTotal > 0 && <p className="small">Today: {todayTotal} reps in total</p>}
            {history.length === 0 ? (
              <p className="small muted">No workouts yet. Pick an exercise and press Start camera.</p>
            ) : (
              history.map((w) => (
                <div key={w.id} className="row between">
                  <span>
                    {EXERCISES[w.exercise].label} <span className="xs muted">{w.date}</span>
                  </span>
                  <strong>
                    {w.reps} reps <span className="xs muted">{w.seconds}s</span>
                  </strong>
                </div>
              ))
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
