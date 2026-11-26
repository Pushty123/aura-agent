/**
 * Rep counting from body landmarks (BlazePose, 33 points, normalised 0..1).
 * Pure functions so they can be tested without a camera.
 */
export interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}

export type ExerciseId = 'squat' | 'pushup' | 'curl';

interface Spec {
  label: string;
  /** [a, vertex, b] landmark indices for the left and right side. */
  left: [number, number, number];
  right: [number, number, number];
  /** Angle (degrees) that counts as the "worked" position and as the "start" position. */
  worked: number;
  start: number;
  hint: string;
}

// BlazePose indices: 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles.
export const EXERCISES: Record<ExerciseId, Spec> = {
  squat: {
    label: 'Squats',
    left: [23, 25, 27],
    right: [24, 26, 28],
    worked: 105,
    start: 160,
    hint: 'Stand side-on, with your whole body in view.',
  },
  pushup: {
    label: 'Push-ups',
    left: [11, 13, 15],
    right: [12, 14, 16],
    worked: 95,
    start: 155,
    hint: 'Place the phone to the side so your arms are visible.',
  },
  curl: {
    label: 'Bicep curls',
    left: [11, 13, 15],
    right: [12, 14, 16],
    worked: 55,
    start: 145,
    hint: 'Face the camera with your upper body and arms in view.',
  },
};

const MIN_VISIBILITY = 0.5;
const MIN_REP_MS = 500;

export function angleAt(a: Landmark, v: Landmark, b: Landmark): number {
  const ax = a.x - v.x;
  const ay = a.y - v.y;
  const bx = b.x - v.x;
  const by = b.y - v.y;
  const dot = ax * bx + ay * by;
  const mag = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (mag === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

export interface RepState {
  reps: number;
  phase: 'waiting' | 'start' | 'worked';
  angle: number | null;
  /** False when the joints needed are not clearly in view. */
  inView: boolean;
}

export class RepCounter {
  private spec: Spec;
  private smooth: number | null = null;
  private lastRepAt = -Infinity;
  state: RepState = { reps: 0, phase: 'waiting', angle: null, inView: false };

  constructor(public readonly exercise: ExerciseId) {
    this.spec = EXERCISES[exercise];
  }

  reset(): void {
    this.smooth = null;
    this.lastRepAt = -Infinity;
    this.state = { reps: 0, phase: 'waiting', angle: null, inView: false };
  }

  /** Feed one frame of landmarks; `nowMs` is the frame time. */
  update(lm: Landmark[] | undefined, nowMs: number): RepState {
    const angle = lm ? this.measure(lm) : null;
    if (angle === null) {
      this.state = { ...this.state, inView: false, angle: null };
      return this.state;
    }
    this.smooth = this.smooth === null ? angle : this.smooth * 0.5 + angle * 0.5;
    const a = this.smooth;
    let { reps, phase } = this.state;

    if (phase === 'waiting' && a >= this.spec.start) phase = 'start';
    else if (phase === 'start' && a <= this.spec.worked) phase = 'worked';
    else if (phase === 'worked' && a >= this.spec.start) {
      phase = 'start';
      if (nowMs - this.lastRepAt >= MIN_REP_MS) {
        reps += 1;
        this.lastRepAt = nowMs;
      }
    }
    this.state = { reps, phase, angle: Math.round(a), inView: true };
    return this.state;
  }

  private measure(lm: Landmark[]): number | null {
    const sides = [this.spec.left, this.spec.right]
      .filter((s) => s.every((i) => (lm[i]?.visibility ?? 0) >= MIN_VISIBILITY))
      .map(([a, v, b]) => angleAt(lm[a], lm[v], lm[b]));
    if (!sides.length) return null;
    return sides.reduce((s, x) => s + x, 0) / sides.length;
  }
}

/** Skeleton lines drawn on the camera preview. */
export const POSE_LINES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];
