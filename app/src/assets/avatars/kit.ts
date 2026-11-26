/**
 * Modular soft-3D SVG layer builder shared by scripts/build-avatars.mjs and Avatar.tsx.
 * Anchor: 256x256 viewBox, head centered at (128, 124), safe zone inside central 80% circle.
 */
import type { AvatarPreset } from './presets';

export function buildAvatarSvgInner(p: AvatarPreset, uid = p.id): string {
  const gBg = `bg-${uid}`;
  const gSkin = `skin-${uid}`;
  const gRim = `rim-${uid}`;
  const gHair = `hair-${uid}`;

  const defs = `<defs>
    <radialGradient id="${gBg}" cx="38%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#323848"/>
      <stop offset="60%" stop-color="#1F212C"/>
      <stop offset="100%" stop-color="#070F0D"/>
    </radialGradient>
    <radialGradient id="${gSkin}" cx="36%" cy="28%" r="70%">
      <stop offset="0%" stop-color="${p.skin}"/>
      <stop offset="78%" stop-color="${p.skin}"/>
      <stop offset="100%" stop-color="${p.skinShadow}"/>
    </radialGradient>
    <linearGradient id="${gRim}" x1="75%" y1="15%" x2="100%" y2="85%">
      <stop offset="0%" stop-color="#35CFC8" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#438CCB" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${gHair}" x1="25%" y1="15%" x2="80%" y2="90%">
      <stop offset="0%" stop-color="${p.hair}"/>
      <stop offset="100%" stop-color="#070F0D" stop-opacity="0.88"/>
    </linearGradient>
  </defs>`;

  const halo = `
    <rect width="256" height="256" fill="url(#${gBg})"/>
    <circle cx="128" cy="128" r="104" stroke="#35CFC8" stroke-opacity="0.24" stroke-width="10"/>
    <circle cx="128" cy="128" r="98" stroke="#35CFC8" stroke-opacity="0.85" stroke-width="3.5"/>
  `;

  const body = `
    <path d="M 62 238 C 64 194, 92 178, 128 178 C 164 178, 192 194, 194 238 Z" fill="${p.outfit}"/>
    <path d="M 96 182 Q 128 202 160 182" stroke="${p.outfitAccent}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <rect x="112" y="160" width="32" height="28" rx="14" fill="${p.skinShadow}"/>
    <ellipse cx="128" cy="170" rx="16" ry="7" fill="#070F0D" fill-opacity="0.25"/>
  `;

  let hairBack = '';
  if (p.hairBack === 'puffs') {
    hairBack = `<circle cx="78" cy="96" r="28" fill="${p.hair}"/><circle cx="178" cy="96" r="28" fill="${p.hair}"/>`;
  } else if (p.hairBack === 'wavy') {
    hairBack = `<path d="M 74 114 C 66 150, 74 176, 86 184 L 170 184 C 182 176, 190 150, 182 114 Z" fill="${p.hair}"/>`;
  } else if (p.hairBack === 'bob') {
    hairBack = `<path d="M 76 110 C 72 150, 78 174, 90 176 L 166 176 C 178 174, 184 150, 180 110 Z" fill="${p.hair}"/>`;
  } else if (p.hairBack === 'braids') {
    hairBack = `
      <rect x="74" y="122" width="16" height="68" rx="8" fill="${p.hair}"/>
      <rect x="166" y="122" width="16" height="68" rx="8" fill="${p.hair}"/>
    `;
  } else if (p.hairBack === 'locs') {
    hairBack = `
      <rect x="72" y="112" width="14" height="76" rx="7" fill="${p.hair}"/>
      <rect x="86" y="122" width="12" height="68" rx="6" fill="${p.hair}"/>
      <rect x="170" y="112" width="14" height="76" rx="7" fill="${p.hair}"/>
      <rect x="158" y="122" width="12" height="68" rx="6" fill="${p.hair}"/>
    `;
  } else if (p.hairBack === 'hijab') {
    hairBack = `<path d="M 70 120 C 70 68, 186 68, 186 120 L 182 192 C 154 204, 102 204, 74 192 Z" fill="${p.hair}"/>`;
  }

  const ears = p.hairBack === 'hijab' || p.hairFront === 'turban' ? '' : `
    <circle cx="80" cy="128" r="11" fill="${p.skinShadow}"/>
    <circle cx="176" cy="128" r="11" fill="${p.skinShadow}"/>
  `;

  const head = `
    <rect x="82" y="72" width="92" height="102" rx="45" fill="url(#${gSkin})"/>
    <rect x="82" y="72" width="92" height="102" rx="45" fill="url(#${gRim})"/>
    <ellipse cx="106" cy="96" rx="14" ry="8" fill="#FFFFFF" fill-opacity="0.12" transform="rotate(-20 106 96)"/>
    <ellipse cx="98" cy="140" rx="9" ry="5" fill="#F04460" fill-opacity="0.16"/>
    <ellipse cx="158" cy="140" rx="9" ry="5" fill="#F04460" fill-opacity="0.16"/>
  `;

  let eyes = '';
  if (p.eyes === 'sleepy') {
    eyes = `
      <path d="M 101 124 Q 109 130 117 124" stroke="#17171E" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 139 124 Q 147 130 155 124" stroke="#17171E" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 99 112 Q 109 109 119 112" stroke="#17171E" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      <path d="M 137 112 Q 147 109 157 112" stroke="#17171E" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    `;
  } else if (p.eyes === 'curious') {
    eyes = `
      <circle cx="109" cy="124" r="6.5" fill="#17171E"/>
      <circle cx="147" cy="124" r="6.5" fill="#17171E"/>
      <circle cx="107" cy="122" r="2.2" fill="#FFFFFF"/>
      <circle cx="145" cy="122" r="2.2" fill="#FFFFFF"/>
      <path d="M 99 109 Q 109 103 119 109" stroke="#17171E" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 137 111 Q 147 108 157 111" stroke="#17171E" stroke-width="4" stroke-linecap="round" fill="none"/>
    `;
  } else {
    eyes = `
      <circle cx="109" cy="124" r="6.2" fill="#17171E"/>
      <circle cx="147" cy="124" r="6.2" fill="#17171E"/>
      <circle cx="107" cy="122" r="2" fill="#FFFFFF"/>
      <circle cx="145" cy="122" r="2" fill="#FFFFFF"/>
      <path d="M 99 111 Q 109 107 119 111" stroke="#17171E" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 137 111 Q 147 107 157 111" stroke="#17171E" stroke-width="4" stroke-linecap="round" fill="none"/>
    `;
  }

  const nose = `<path d="M 125 135 Q 128 139 131 135" stroke="${p.skinShadow}" stroke-width="3" stroke-linecap="round" fill="none"/>`;

  let mouth = `<path d="M 118 148 Q 128 156 138 148" stroke="#17171E" stroke-width="3.6" stroke-linecap="round" fill="none"/>`;
  if (p.mouth === 'grin') {
    mouth = `<path d="M 116 147 Q 128 159 140 147 Z" fill="#F4F5F7" stroke="#17171E" stroke-width="2.5" stroke-linejoin="round"/>`;
  } else if (p.mouth === 'calm') {
    mouth = `<path d="M 120 150 Q 128 153 136 150" stroke="#17171E" stroke-width="3.4" stroke-linecap="round" fill="none"/>`;
  }

  let hairFront = '';
  switch (p.hairFront) {
    case 'coils':
      hairFront = `<path d="M 82 104 C 82 66, 174 66, 174 104 C 156 88, 100 88, 82 104 Z" fill="${p.hair}"/>`;
      break;
    case 'wavy-streak':
      hairFront = `
        <path d="M 80 108 C 80 64, 176 64, 176 108 C 154 88, 118 82, 80 108 Z" fill="${p.hair}"/>
        <path d="M 134 74 C 154 78, 166 90, 172 104" stroke="${p.hairAccent ?? '#35CFC8'}" stroke-width="6" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'beanie':
      hairFront = `
        <path d="M 78 100 C 80 56, 176 56, 178 100 Z" fill="#323848"/>
        <rect x="74" y="88" width="108" height="18" rx="9" fill="#1F212C" stroke="#35CFC8" stroke-width="2.5"/>
        <circle cx="128" cy="56" r="10" fill="#35CFC8"/>
      `;
      break;
    case 'bun':
      hairFront = `
        <circle cx="128" cy="54" r="20" fill="${p.hair}"/>
        <path d="M 82 104 C 84 68, 172 68, 174 104 C 150 88, 106 88, 82 104 Z" fill="${p.hair}"/>
        <path d="M 112 68 Q 128 74 144 68" stroke="#8974E8" stroke-width="4" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'hijab':
      hairFront = `
        <path d="M 76 112 C 76 66, 180 66, 180 112 C 162 82, 94 82, 76 112 Z" fill="${p.hair}"/>
        <path d="M 80 112 C 92 84, 164 84, 176 112" stroke="${p.hairAccent ?? '#35CFC8'}" stroke-width="3.5" fill="none"/>
      `;
      break;
    case 'bob':
      hairFront = `
        <path d="M 78 108 C 80 64, 176 64, 178 108 C 156 84, 100 84, 78 108 Z" fill="${p.hair}"/>
        <path d="M 90 86 Q 112 76 132 82" stroke="${p.hairAccent ?? '#8974E8'}" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'crop':
      hairFront = `<path d="M 84 98 C 88 68, 168 68, 172 98 C 150 86, 106 86, 84 98 Z" fill="${p.hair}"/>`;
      break;
    case 'braids':
    case 'locs':
      hairFront = `<path d="M 80 104 C 84 66, 172 66, 176 104 C 150 86, 106 86, 80 104 Z" fill="${p.hair}"/>`;
      break;
    case 'side-part':
      hairFront = `<path d="M 80 106 C 82 66, 174 68, 176 102 C 152 82, 114 96, 80 106 Z" fill="${p.hair}"/>`;
      break;
    case 'turban':
      hairFront = `
        <path d="M 76 104 C 76 58, 180 58, 180 104 C 156 92, 100 92, 76 104 Z" fill="${p.hair}"/>
        <path d="M 82 88 Q 128 74 174 88" stroke="#454B5C" stroke-width="3" fill="none"/>
        <circle cx="128" cy="76" r="5" fill="${p.hairAccent ?? '#35CFC8'}"/>
      `;
      break;
    case 'bald':
      hairFront = `<ellipse cx="110" cy="84" rx="16" ry="7" fill="#FFFFFF" fill-opacity="0.22" transform="rotate(-18 110 84)"/>`;
      break;
  }

  let acc = '';
  if (p.accessory === 'hoops') {
    acc = `
      <circle cx="77" cy="140" r="6" stroke="#35CFC8" stroke-width="2.6" fill="none"/>
      <circle cx="179" cy="140" r="6" stroke="#35CFC8" stroke-width="2.6" fill="none"/>
    `;
  } else if (p.accessory === 'studs') {
    acc = `
      <circle cx="78" cy="136" r="3" fill="#8974E8"/>
      <circle cx="178" cy="136" r="3" fill="#8974E8"/>
    `;
  } else if (p.accessory === 'round-glasses') {
    acc = `
      <circle cx="109" cy="124" r="14" stroke="#F4F5F7" stroke-width="3" fill="#35CFC8" fill-opacity="0.08"/>
      <circle cx="147" cy="124" r="14" stroke="#F4F5F7" stroke-width="3" fill="#35CFC8" fill-opacity="0.08"/>
      <path d="M 123 124 H 133" stroke="#F4F5F7" stroke-width="3"/>
    `;
  } else if (p.accessory === 'geo-glasses' || p.accessory === 'rect-glasses') {
    acc = `
      <rect x="94" y="113" width="28" height="21" rx="6" stroke="#35CFC8" stroke-width="3" fill="#35CFC8" fill-opacity="0.08"/>
      <rect x="134" y="113" width="28" height="21" rx="6" stroke="#35CFC8" stroke-width="3" fill="#35CFC8" fill-opacity="0.08"/>
      <path d="M 122 123 H 134" stroke="#35CFC8" stroke-width="3"/>
    `;
  } else if (p.accessory === 'headphones') {
    acc = `
      <path d="M 74 124 C 74 62, 182 62, 182 124" stroke="#35CFC8" stroke-width="6" stroke-linecap="round" fill="none"/>
      <rect x="66" y="112" width="14" height="30" rx="7" fill="#1F212C" stroke="#35CFC8" stroke-width="2.5"/>
      <rect x="176" y="112" width="14" height="30" rx="7" fill="#1F212C" stroke="#35CFC8" stroke-width="2.5"/>
    `;
  } else if (p.accessory === 'cap') {
    acc = `
      <path d="M 78 96 C 82 58, 174 58, 178 96 Z" fill="#1F212C" stroke="#454B5C" stroke-width="2"/>
      <path d="M 76 96 H 188 C 188 103, 168 104, 152 102 H 76 Z" fill="#35CFC8"/>
    `;
  }

  return `${defs}${halo}${hairBack}${body}${ears}${head}${eyes}${nose}${mouth}${hairFront}${acc}`;
}
