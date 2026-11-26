import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { AVATAR_PRESETS } from '../src/assets/avatars/presets.ts';
import { buildAvatarSvgInner } from '../src/assets/avatars/kit.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../src/assets/avatars');
fs.mkdirSync(outDir, { recursive: true });

for (const preset of AVATAR_PRESETS) {
  const inner = buildAvatarSvgInner(preset, preset.id);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">\n${inner}\n</svg>\n`;
  const base = `avatar-${preset.id}`;
  fs.writeFileSync(path.join(outDir, `${base}.svg`), svg);

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } });
  fs.writeFileSync(path.join(outDir, `${base}.png`), resvg.render().asPng());
}

console.log(`Generated ${AVATAR_PRESETS.length} soft-3D avatar SVGs and 512px PNGs.`);
