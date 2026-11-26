// Copies the pose model files that ship inside the npm package into public/mediapipe,
// so the app runs detection fully offline from its own bundle.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'pose');
const to = join(root, 'public', 'mediapipe');
const files = [
  'pose.js',
  'pose_solution_packed_assets.data',
  'pose_solution_packed_assets_loader.js',
  'pose_solution_simd_wasm_bin.js',
  'pose_solution_simd_wasm_bin.wasm',
  'pose_solution_simd_wasm_bin.data',
  'pose_solution_wasm_bin.js',
  'pose_solution_wasm_bin.wasm',
  'pose_web.binarypb',
  'pose_landmark_lite.tflite',
];

if (!existsSync(from)) {
  console.error('Missing @mediapipe/pose. Run npm install first.');
  process.exit(1);
}
mkdirSync(to, { recursive: true });
for (const f of files) {
  if (existsSync(join(from, f))) cpSync(join(from, f), join(to, f));
}
console.log(`Copied pose model files to ${to}`);
