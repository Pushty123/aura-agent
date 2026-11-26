import { describe, expect, it } from 'vitest';
import { angleAt, RepCounter, type Landmark } from '../src/exercise/reps';

/** Build 33 landmarks where both knees (and elbows) have the given joint angle. */
function pose(angleDeg: number): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }));
  const rad = (angleDeg * Math.PI) / 180;
  const place = (a: number, v: number, b: number, cx: number) => {
    lm[v] = { x: cx, y: 0.5, visibility: 0.99 };
    lm[a] = { x: cx, y: 0.3, visibility: 0.99 }; // straight up from the joint
    lm[b] = { x: cx + 0.2 * Math.sin(Math.PI - rad) * -1 * -1, y: 0.5 - 0.2 * Math.cos(Math.PI - rad) * -1, visibility: 0.99 };
  };
  // Left and right: legs and arms use the same layout.
  place(23, 25, 27, 0.4);
  place(24, 26, 28, 0.6);
  place(11, 13, 15, 0.4);
  place(12, 14, 16, 0.6);
  return lm;
}

function run(counter: RepCounter, angles: number[], stepMs = 200) {
  let t = 0;
  for (const a of angles) {
    counter.update(pose(a), t);
    t += stepMs;
  }
}

// A full rep, followed by two frames standing still so the smoothed angle settles.
const SQUAT_REP = [175, 150, 120, 90, 80, 100, 130, 160, 175, 175, 175];

describe('angleAt', () => {
  it('measures a right angle and a straight line', () => {
    expect(angleAt({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 5);
    expect(angleAt({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180, 5);
  });
});

describe('pose helper sanity', () => {
  it('produces the angle we ask for', () => {
    const lm = pose(90);
    expect(angleAt(lm[23], lm[25], lm[27])).toBeCloseTo(90, 0);
    const s = pose(140);
    expect(angleAt(s[23], s[25], s[27])).toBeCloseTo(140, 0);
  });
});

describe('RepCounter', () => {
  it('counts three squats', () => {
    const c = new RepCounter('squat');
    run(c, [...SQUAT_REP, ...SQUAT_REP, ...SQUAT_REP]);
    expect(c.state.reps).toBe(3);
  });

  it('does not count a half squat that never gets deep enough', () => {
    const c = new RepCounter('squat');
    run(c, [175, 150, 130, 125, 140, 170, 175]);
    expect(c.state.reps).toBe(0);
  });

  it('does not count before the person has stood fully upright', () => {
    const c = new RepCounter('squat');
    run(c, [100, 90, 100, 120, 140]);
    expect(c.state.reps).toBe(0);
  });

  it('ignores a rep that is faster than half a second', () => {
    const c = new RepCounter('squat');
    run(c, [...SQUAT_REP, ...SQUAT_REP], 20);
    expect(c.state.reps).toBeLessThan(2);
  });

  it('counts curls and push-ups with their own thresholds', () => {
    const curl = new RepCounter('curl');
    run(curl, [170, 120, 60, 40, 40, 40, 60, 120, 160, 170, 170, 170]);
    expect(curl.state.reps).toBe(1);
    const push = new RepCounter('pushup');
    run(push, [170, 130, 90, 80, 80, 80, 100, 140, 165, 170, 170, 170]);
    expect(push.state.reps).toBe(1);
  });

  it('reports not in view when landmarks are hidden, and keeps the count', () => {
    const c = new RepCounter('squat');
    run(c, SQUAT_REP);
    expect(c.state.reps).toBe(1);
    const hidden = pose(170).map((p) => ({ ...p, visibility: 0.1 }));
    c.update(hidden, 5000);
    expect(c.state.inView).toBe(false);
    expect(c.state.reps).toBe(1);
    c.update(undefined, 5200);
    expect(c.state.inView).toBe(false);
  });

  it('reset clears the count', () => {
    const c = new RepCounter('squat');
    run(c, SQUAT_REP);
    c.reset();
    expect(c.state.reps).toBe(0);
    expect(c.state.phase).toBe('waiting');
  });
});
