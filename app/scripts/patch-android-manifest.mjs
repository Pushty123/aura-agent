// Adds the camera permission to the generated Android project (it is git-ignored,
// so this runs after every `cap sync`). Safe to run many times.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!existsSync(file)) {
  console.log('No android project yet. Run: npm run cap:add:android');
  process.exit(0);
}
let xml = readFileSync(file, 'utf8');
const lines = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
];
const missing = lines.filter((l) => !xml.includes(l.match(/android:name="([^"]+)"/)[0]));
if (missing.length) {
  xml = xml.replace('<application', `${missing.map((l) => `    ${l}\n`).join('')}\n    <application`);
  writeFileSync(file, xml);
  console.log(`Added to AndroidManifest.xml:\n${missing.join('\n')}`);
} else {
  console.log('AndroidManifest.xml already has the camera permission.');
}
