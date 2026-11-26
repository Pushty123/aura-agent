import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const brandDir = path.join(appRoot, 'src/assets/brand');
const publicDir = path.join(appRoot, 'public');
const androidDir = path.join(brandDir, 'android');

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(androidDir, { recursive: true });

function renderPng(svgString, size) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: size },
  });
  return resvg.render().asPng();
}

function writeIco(pngBuffersWithSizes, outPath) {
  const count = pngBuffersWithSizes.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = ICO
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  let offset = 6 + count * 16;

  for (const { size, buf } of pngBuffersWithSizes) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += buf.length;
  }

  fs.writeFileSync(outPath, Buffer.concat([header, ...dirEntries, ...pngBuffersWithSizes.map((x) => x.buf)]));
}

// 1. Copy favicon.svg to public/
const faviconSvg = fs.readFileSync(path.join(brandDir, 'favicon.svg'), 'utf8');
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg);

// 2. Simplified high-legibility favicon PNGs (16, 32, 48) + favicon.ico
const smallFaviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="16" fill="#070F0D"/>
  <path d="M 32 13 A 19 19 0 1 1 14.5 39.5" stroke="#35CFC8" stroke-width="7.5" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="6" fill="#35CFC8"/>
</svg>`;

const png16 = renderPng(smallFaviconSvg, 16);
const png32 = renderPng(smallFaviconSvg, 32);
const png48 = renderPng(smallFaviconSvg, 48);

fs.writeFileSync(path.join(publicDir, 'favicon-16.png'), png16);
fs.writeFileSync(path.join(publicDir, 'favicon-32.png'), png32);
writeIco(
  [
    { size: 16, buf: png16 },
    { size: 32, buf: png32 },
    { size: 48, buf: png48 },
  ],
  path.join(publicDir, 'favicon.ico'),
);

// 3. App tile SVGs & PWA icons (180, 192, 512, maskable 512)
function makeTileSvg({ rounded = true, safeScale = 1 } = {}) {
  const rx = rounded ? 112 : 0;
  const offset = 256 * (1 - safeScale);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <radialGradient id="tile-bg" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#1F212C"/>
      <stop offset="100%" stop-color="#070F0D"/>
    </radialGradient>
    <radialGradient id="tile-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#35CFC8" stop-opacity="0.26"/>
      <stop offset="60%" stop-color="#438CCB" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#070F0D" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="tile-ring" x1="96" y1="96" x2="416" y2="416" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#35CFC8"/>
      <stop offset="68%" stop-color="#438CCB"/>
      <stop offset="100%" stop-color="#8974E8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#tile-bg)"/>
  <g transform="translate(${offset}, ${offset}) scale(${safeScale})">
    <circle cx="256" cy="256" r="190" fill="url(#tile-glow)"/>
    <circle cx="256" cy="256" r="154" stroke="#454B5C" stroke-opacity="0.35" stroke-width="28"/>
    <path d="M 256 102 A 154 154 0 1 1 114.6 316.5" stroke="url(#tile-ring)" stroke-width="34" stroke-linecap="round"/>
    <circle cx="256" cy="256" r="52" fill="#35CFC8" fill-opacity="0.18"/>
    <circle cx="256" cy="256" r="28" fill="#35CFC8"/>
  </g>
</svg>`;
}

const tileRoundedSvg = makeTileSvg({ rounded: true, safeScale: 0.92 });
const tileMaskSvg = makeTileSvg({ rounded: false, safeScale: 0.76 });

fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderPng(makeTileSvg({ rounded: false, safeScale: 0.88 }), 180));
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), renderPng(tileRoundedSvg, 192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), renderPng(tileRoundedSvg, 512));
fs.writeFileSync(path.join(publicDir, 'icon-maskable-512.png'), renderPng(tileMaskSvg, 512));

// 4. Android Adaptive Icon Layers (108dp canvas; 66dp safe zone -> ~61% central area)
const androidForegroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" fill="none">
  <defs>
    <linearGradient id="fg-ring" x1="27" y1="27" x2="81" y2="81" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#35CFC8"/>
      <stop offset="68%" stop-color="#438CCB"/>
      <stop offset="100%" stop-color="#8974E8"/>
    </linearGradient>
  </defs>
  <circle cx="54" cy="54" r="24" stroke="#454B5C" stroke-opacity="0.35" stroke-width="5"/>
  <path d="M 54 30 A 24 24 0 1 1 32 63.4" stroke="url(#fg-ring)" stroke-width="6" stroke-linecap="round"/>
  <circle cx="54" cy="54" r="8" fill="#35CFC8" fill-opacity="0.2"/>
  <circle cx="54" cy="54" r="4.5" fill="#35CFC8"/>
</svg>`;

const androidBackgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" fill="none">
  <defs>
    <radialGradient id="bg-grad" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="#1F212C"/>
      <stop offset="100%" stop-color="#070F0D"/>
    </radialGradient>
  </defs>
  <rect width="108" height="108" fill="url(#bg-grad)"/>
</svg>`;

const androidMonoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" fill="none">
  <path d="M 54 30 A 24 24 0 1 1 32 63.4" stroke="#35CFC8" stroke-width="6.5" stroke-linecap="round"/>
  <circle cx="54" cy="54" r="4.8" fill="#35CFC8"/>
</svg>`;

fs.writeFileSync(path.join(androidDir, 'ic_launcher_foreground.svg'), androidForegroundSvg);
fs.writeFileSync(path.join(androidDir, 'ic_launcher_foreground.png'), renderPng(androidForegroundSvg, 432));

fs.writeFileSync(path.join(androidDir, 'ic_launcher_background.svg'), androidBackgroundSvg);
fs.writeFileSync(path.join(androidDir, 'ic_launcher_background.png'), renderPng(androidBackgroundSvg, 432));

fs.writeFileSync(path.join(androidDir, 'ic_launcher_monochrome.svg'), androidMonoSvg);
fs.writeFileSync(path.join(androidDir, 'ic_launcher_monochrome.png'), renderPng(androidMonoSvg, 432));

// Legacy mipmap PNGs (48, 72, 96, 144, 192)
const mipmaps = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
];
for (const [folder, px] of mipmaps) {
  const dir = path.join(androidDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), renderPng(tileRoundedSvg, px));
}

// Play Store 512x512
fs.writeFileSync(path.join(androidDir, 'playstore-512.png'), renderPng(makeTileSvg({ rounded: false, safeScale: 0.88 }), 512));

// Splash 2732x2732 (mark kept in centre ~25%)
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732" fill="none">
  <rect width="2732" height="2732" fill="#070F0D"/>
  <g transform="translate(1024, 1024) scale(1.3359375)">
    <defs>
      <linearGradient id="sp-ring" x1="96" y1="96" x2="416" y2="416" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#35CFC8"/>
        <stop offset="68%" stop-color="#438CCB"/>
        <stop offset="100%" stop-color="#8974E8"/>
      </linearGradient>
    </defs>
    <circle cx="256" cy="256" r="154" stroke="#454B5C" stroke-opacity="0.35" stroke-width="26"/>
    <path d="M 256 102 A 154 154 0 1 1 114.6 316.5" stroke="url(#sp-ring)" stroke-width="32" stroke-linecap="round"/>
    <circle cx="256" cy="256" r="50" fill="#35CFC8" fill-opacity="0.18"/>
    <circle cx="256" cy="256" r="26" fill="#35CFC8"/>
  </g>
</svg>`;
fs.writeFileSync(path.join(androidDir, 'splash-2732.png'), renderPng(splashSvg, 2732));

console.log('Generated all AURA brand raster & ICO assets successfully.');
