import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { AvatarPreset } from '../assets/avatars/presets';
import type { Mood } from './mood';

/**
 * AURA's original 3D avatar, built from simple shapes with soft lighting and
 * coloured from the same presets as the 2D avatars. It breathes, blinks, can be
 * dragged to turn, and its face and aura follow the person's mood.
 * Runs entirely on the device (WebGL); nothing is downloaded.
 */
interface Props {
  preset: AvatarPreset;
  mood?: Mood;
  size: number;
  /** Allow dragging to turn the avatar. */
  interactive?: boolean;
  /** Draw the glowing halo behind the character. */
  halo?: boolean;
}

const mat = (color: string, rough = 0.55, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });

function sphere(r: number, m: THREE.Material, seg = 48) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), m);
}

/** Part of a sphere: theta = from the top (0) downwards. */
function cap(r: number, m: THREE.Material, thetaLen: number, phiStart = 0, phiLen = Math.PI * 2) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32, phiStart, phiLen, 0, thetaLen), m);
}

function arc(radius: number, tube: number, angle: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 32, angle), m);
  return mesh;
}

export function buildCharacter(p: AvatarPreset, mood?: Mood) {
  const root = new THREE.Group();
  const skin = mat(p.skin, 0.6);
  const skinShadow = mat(p.skinShadow, 0.7);
  const hair = mat(p.hair, 0.45, { metalness: 0.05 });
  const accentHair = p.hairAccent ? mat(p.hairAccent, 0.4) : hair;
  const outfit = mat(p.outfit, 0.8);
  const accent = mat(p.outfitAccent, 0.5);
  const white = mat('#FAFAFC', 0.25);
  const dark = mat('#17171E', 0.3);
  const gold = mat('#E5B85C', 0.25, { metalness: 0.6 });
  const metal = mat('#C9CED8', 0.25, { metalness: 0.7 });

  // Body and neck
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.5, 8, 32), outfit);
  body.scale.set(1.25, 1, 0.8);
  body.position.y = -1.55;
  root.add(body);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 12, 40), accent);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -0.95;
  root.add(collar);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.35, 24), skinShadow);
  neck.position.y = -0.82;
  root.add(neck);

  // Head
  const head = new THREE.Group();
  root.add(head);
  const face = sphere(0.72, skin);
  face.scale.set(0.95, 1.04, 0.92);
  head.add(face);
  for (const side of [-1, 1]) {
    const ear = sphere(0.14, skin, 24);
    ear.scale.set(0.6, 1, 0.6);
    ear.position.set(0.68 * side, -0.02, 0);
    head.add(ear);
  }
  const nose = sphere(0.075, skinShadow, 24);
  nose.position.set(0, -0.08, 0.66);
  head.add(nose);
  for (const side of [-1, 1]) {
    const cheek = sphere(0.11, mat('#F08A8A', 0.9, { transparent: true, opacity: 0.35 }), 24);
    cheek.scale.set(1, 0.6, 0.3);
    cheek.position.set(0.36 * side, -0.16, 0.56);
    head.add(cheek);
  }

  // Eyes (scaled on the y axis to blink)
  const eyes: THREE.Group[] = [];
  const eyeStyle = mood?.eyes ?? p.eyes;
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    const ball = sphere(0.12, white, 24);
    ball.scale.set(1, 1.1, 0.5);
    eye.add(ball);
    const pupil = sphere(0.07, dark, 24);
    pupil.position.set(0, eyeStyle === 'curious' ? 0.02 : -0.01, 0.05);
    pupil.scale.set(1, 1.1, 0.5);
    eye.add(pupil);
    const glint = sphere(0.02, white, 12);
    glint.position.set(0.025, 0.035, 0.09);
    eye.add(glint);
    if (eyeStyle === 'sleepy') {
      const lid = cap(0.13, skin, Math.PI / 2);
      lid.scale.set(1, 1.1, 0.55);
      lid.rotation.x = 0.35;
      eye.add(lid);
    }
    eye.position.set(0.24 * side, 0.08, 0.6);
    head.add(eye);
    eyes.push(eye);
    // Brows
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.14, 4, 8), hair);
    brow.rotation.z = Math.PI / 2 + (eyeStyle === 'focused' ? -0.25 * side : 0.08 * side);
    brow.position.set(0.24 * side, eyeStyle === 'curious' ? 0.3 : 0.26, 0.62);
    head.add(brow);
  }

  // Mouth
  const mouthStyle = mood?.mouth ?? p.mouth;
  if (mouthStyle === 'grin') {
    const grin = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32, Math.PI, Math.PI), white);
    grin.position.set(0, -0.3, 0.64);
    grin.rotation.x = -0.15;
    head.add(grin);
    const lip = arc(0.15, 0.018, Math.PI, dark);
    lip.rotation.z = Math.PI;
    lip.position.set(0, -0.3, 0.645);
    head.add(lip);
  } else {
    const curve = mouthStyle === 'calm' ? 0.55 : mouthStyle === 'relaxed' ? 0.8 : 1.1;
    const r = mouthStyle === 'calm' ? 0.16 : 0.12;
    const m = arc(r, 0.02, curve, dark);
    m.rotation.z = Math.PI + (Math.PI - curve) / 2;
    m.position.set(0, -0.3 + r * Math.cos(curve / 2) * 0.9, 0.655);
    head.add(m);
  }

  // Hair: back layer
  const back = p.hairBack;
  if (back === 'puffs') {
    for (const side of [-1, 1]) {
      const puff = sphere(0.36, hair, 32);
      puff.position.set(0.62 * side, 0.55, -0.1);
      head.add(puff);
    }
  } else if (back === 'wavy' || back === 'bob') {
    // Behind the head only (three.js: phi = PI..2PI is the back half).
    const shell = cap(0.8, hair, Math.PI * (back === 'bob' ? 0.62 : 0.75), Math.PI - 0.35, Math.PI + 0.7);
    shell.scale.set(1.02, 1.08, 1);
    shell.position.set(0, 0.02, -0.04);
    head.add(shell);
  } else if (back === 'braids' || back === 'locs') {
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * 0.85 + (i / 7) * Math.PI * 0.7 - Math.PI / 2 + Math.PI;
      const strand = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.9, 4, 12), i % 3 === 0 ? accentHair : hair);
      strand.position.set(Math.cos(a) * 0.62, -0.45, Math.sin(a) * 0.55 - 0.1);
      head.add(strand);
    }
  } else if (back === 'hijab') {
    const wrap = cap(0.86, accent, Math.PI * 0.85, Math.PI - 0.55, Math.PI + 1.1);
    wrap.scale.set(1, 1.12, 1);
    wrap.position.set(0, -0.02, -0.02);
    head.add(wrap);
    const crown = cap(0.84, accent, Math.PI * 0.3);
    crown.scale.set(1, 1.12, 1);
    crown.rotation.x = -0.3;
    head.add(crown);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.85, 0.7, 40, 1, true), accent);
    drape.position.y = -0.85;
    head.add(drape);
  }

  // Hair: front layer
  const front = p.hairFront;
  const topCap = (theta: number, m: THREE.Material = hair, r = 0.76) => {
    const c = cap(r, m, theta);
    c.scale.set(1, 1.06, 1);
    c.rotation.x = -0.25;
    c.position.y = 0.04;
    head.add(c);
    return c;
  };
  if (front === 'coils') {
    topCap(Math.PI * 0.4);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const curl = sphere(0.14, hair, 16);
      curl.position.set(Math.cos(a) * 0.42, 0.62 + Math.sin(i) * 0.03, Math.sin(a) * 0.38 - 0.05);
      head.add(curl);
    }
  } else if (front === 'wavy-streak') {
    topCap(Math.PI * 0.42);
    const streak = cap(0.775, accentHair, Math.PI * 0.42, Math.PI * 0.3, 0.35);
    streak.rotation.x = -0.25;
    streak.position.y = 0.045;
    head.add(streak);
  } else if (front === 'beanie') {
    topCap(Math.PI * 0.45, accent, 0.79);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 12, 48), outfit);
    band.rotation.x = Math.PI / 2 - 0.25;
    band.position.set(0, 0.3, 0.06);
    head.add(band);
    const pom = sphere(0.14, accent, 24);
    pom.position.set(0, 0.88, -0.1);
    head.add(pom);
  } else if (front === 'bun') {
    topCap(Math.PI * 0.4);
    const bun = sphere(0.26, hair, 32);
    bun.position.set(0, 0.86, -0.18);
    head.add(bun);
  } else if (front === 'bob' || front === 'side-part') {
    topCap(Math.PI * 0.45);
  } else if (front === 'crop') {
    topCap(Math.PI * 0.3);
  } else if (front === 'braids' || front === 'locs') {
    topCap(Math.PI * 0.38);
  } else if (front === 'turban') {
    const t = topCap(Math.PI * 0.42, accent, 0.82);
    t.scale.set(1.05, 1.15, 1.02);
    const fold = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 12, 40), outfit);
    fold.rotation.x = Math.PI / 2 - 0.4;
    fold.position.set(0, 0.62, 0.05);
    head.add(fold);
  } else if (front === 'hijab') {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.1, 16, 48), accent);
    frame.scale.set(0.95, 1.08, 1);
    frame.position.z = 0.22;
    head.add(frame);
  }
  // bald: nothing

  // Accessories
  if (p.accessory === 'round-glasses' || p.accessory === 'geo-glasses' || p.accessory === 'rect-glasses') {
    const frameMat = p.accessory === 'round-glasses' ? dark : accent;
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.02, 8, p.accessory === 'round-glasses' ? 32 : p.accessory === 'geo-glasses' ? 6 : 4),
        frameMat,
      );
      if (p.accessory === 'rect-glasses') lens.rotation.z = Math.PI / 4;
      lens.position.set(0.24 * side, 0.08, 0.68);
      head.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8), frameMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.1, 0.7);
    head.add(bridge);
  } else if (p.accessory === 'hoops') {
    for (const side of [-1, 1]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 24), gold);
      hoop.position.set(0.7 * side, -0.2, 0.02);
      hoop.rotation.y = Math.PI / 2;
      head.add(hoop);
    }
  } else if (p.accessory === 'studs') {
    for (const side of [-1, 1]) {
      const stud = sphere(0.035, metal, 12);
      stud.position.set(0.71 * side, -0.1, 0.02);
      head.add(stud);
    }
  } else if (p.accessory === 'headphones') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 12, 48, Math.PI), dark);
    band.position.set(0, 0.05, -0.05);
    head.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 32), accent);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(0.78 * side, 0.02, 0);
      head.add(cup);
    }
  } else if (p.accessory === 'cap') {
    topCap(Math.PI * 0.42, accent, 0.8);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32, 1, false, 0, Math.PI), accent);
    brim.position.set(0, 0.5, 0.42);
    brim.rotation.x = 0.2;
    head.add(brim);
  }

  head.position.y = 0.05;
  return { root, head, eyes };
}

export default function Avatar3D({ preset, mood, size, interactive = true, halo: showHalo = true }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return; // No WebGL: the 2D fallback stays visible.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = interactive ? 'none' : 'auto';
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    // Closer framing when shown inside the app's own ring (no halo).
    camera.position.set(0, -0.1, showHalo ? 5.6 : 4.5);
    camera.lookAt(0, showHalo ? -0.25 : -0.15, 0);

    const auraColor = new THREE.Color(mood?.color ?? '#35CFC8');
    scene.add(new THREE.HemisphereLight('#ffffff', '#3a3f55', 1.1));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(auraColor, 2.4);
    rim.position.set(-3, 1, -3);
    scene.add(rim);

    // Aura halo behind the character
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.045, 16, 96),
      new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.85 }),
    );
    halo.position.set(0, -0.2, -1);
    if (showHalo) scene.add(halo);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 64),
      new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.12 }),
    );
    glow.position.set(0, -0.2, -1.05);
    if (showHalo) scene.add(glow);

    const { root, head, eyes } = buildCharacter(preset, mood);
    scene.add(root);

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let targetYaw = 0;
    let yaw = 0;
    let dragging = false;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      targetYaw = Math.max(-1.2, Math.min(1.2, targetYaw + (e.clientX - lastX) * 0.012));
      lastX = e.clientX;
    };
    const up = () => {
      dragging = false;
    };
    if (interactive) {
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
    }

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(el);
    const clock = new THREE.Clock();
    let nextBlink = 2;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const t = clock.getElapsedTime();
      if (!dragging) targetYaw *= 0.96;
      yaw += (targetYaw - yaw) * 0.12;
      root.rotation.y = yaw + (still ? 0 : Math.sin(t * 0.6) * 0.08);
      if (!still) {
        root.position.y = Math.sin(t * 1.4) * 0.04;
        head.rotation.z = Math.sin(t * 0.9) * 0.03;
        halo.rotation.z = t * 0.2;
        const blink = t > nextBlink && t < nextBlink + 0.14;
        if (t > nextBlink + 0.14) nextBlink = t + 2.5 + Math.random() * 3;
        for (const e of eyes) e.scale.y = blink ? 0.1 : 1;
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mt = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mt)) mt.forEach((x) => x.dispose());
        else mt?.dispose();
      });
      renderer.dispose();
      el.innerHTML = '';
    };
  }, [preset, mood?.eyes, mood?.mouth, mood?.color, size, interactive, showHalo]);

  return <div ref={host} style={{ width: size, height: size }} aria-hidden="true" />;
}
