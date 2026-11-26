import type { Pose } from '@mediapipe/pose';

/**
 * Loads the pose model that ships INSIDE the app (public/mediapipe, copied from
 * the npm package at build time). Nothing is downloaded and no video leaves the
 * phone; detection runs locally in the WebView.
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-aura-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.auraSrc = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('The pose model files are missing from this build.'));
    document.head.appendChild(s);
  });
}

export async function createPose(): Promise<Pose> {
  const base = `${import.meta.env.BASE_URL}mediapipe/`;
  await loadScript(`${base}pose.js`);
  const Ctor = (window as unknown as { Pose?: new (c: { locateFile: (f: string) => string }) => Pose }).Pose;
  if (!Ctor) throw new Error('The pose model could not start on this device.');
  const pose = new Ctor({ locateFile: (f) => `${base}${f}` });
  pose.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  await pose.initialize();
  return pose;
}
