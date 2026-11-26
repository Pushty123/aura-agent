export interface PrivacySafeSummary {
  score: number | null;
  statusLabel: string;
  weekScores: number[];
  avgSleepHours: number | null;
  avgSteps: number | null;
  avgScreenHours: number | null;
  avgMood: number | null;
  goalsMet: number;
  goalsTotal: number;
  streakLabel: string;
  streakDays: number;
  topWin: string;
  date: string;
  isDemo: boolean;
}

/**
 * Builds a privacy-safe summary containing only aggregate score, 7-day trend,
 * weekly averages, goals count, streak, and top win — never symptoms, period logs,
 * app names, or personal identifiers.
 */
export function buildPrivacySafeSummary(input: {
  score?: number | null;
  statusLabel?: string;
  weekScores?: number[];
  avgSleepHours?: number | null;
  avgSteps?: number | null;
  avgScreenHours?: number | null;
  avgMood?: number | null;
  goalsMet?: number;
  goalsTotal?: number;
  streakLabel?: string;
  streakDays?: number;
  topWin?: string;
  date: string;
  isDemo?: boolean;
}): PrivacySafeSummary {
  const safeScore = typeof input.score === 'number' ? Math.max(0, Math.min(100, Math.round(input.score))) : null;
  const safeDays = typeof input.streakDays === 'number' && input.streakDays > 0 ? Math.round(input.streakDays) : 0;
  const defaultStatus =
    safeScore === null ? 'Building baseline' : safeScore >= 75 ? 'In balance' : safeScore >= 50 ? 'Steady week' : 'Needs rest';

  return {
    score: safeScore,
    statusLabel: (input.statusLabel ?? defaultStatus).trim().slice(0, 32),
    weekScores: (input.weekScores ?? []).slice(-7).map((s) => Math.max(0, Math.min(100, Math.round(s)))),
    avgSleepHours: typeof input.avgSleepHours === 'number' ? Math.round(input.avgSleepHours * 10) / 10 : null,
    avgSteps: typeof input.avgSteps === 'number' ? Math.round(input.avgSteps) : null,
    avgScreenHours: typeof input.avgScreenHours === 'number' ? Math.round(input.avgScreenHours * 10) / 10 : null,
    avgMood: typeof input.avgMood === 'number' ? Math.round(input.avgMood * 10) / 10 : null,
    goalsMet: Math.max(0, Math.round(input.goalsMet ?? 0)),
    goalsTotal: Math.max(0, Math.round(input.goalsTotal ?? 0)),
    streakLabel: (input.streakLabel ?? 'Daily check-in').trim().slice(0, 40),
    streakDays: safeDays,
    topWin: (input.topWin ?? 'Consistent wellness tracking').trim().slice(0, 80),
    date: input.date,
    isDemo: Boolean(input.isDemo),
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Renders a clean 1080x1350 PNG card 100% on-device using HTML5 Canvas. */
export async function renderSummaryCardPng(summary: PrivacySafeSummary): Promise<Blob> {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');

  // Background gradient
  const bg = ctx.createRadialGradient(540, 200, 60, 540, 620, 900);
  bg.addColorStop(0, '#12332F');
  bg.addColorStop(0.55, '#0B1716');
  bg.addColorStop(1, '#070F0D');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Outer card
  ctx.fillStyle = '#1F212C';
  ctx.strokeStyle = '#384152';
  ctx.lineWidth = 3;
  roundRect(ctx, 64, 64, width - 128, height - 128, 44);
  ctx.fill();
  ctx.stroke();

  // Header
  ctx.fillStyle = '#35CFC8';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('AURA · WEEKLY SNAPSHOT', 120, 148);

  if (summary.isDemo) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
    roundRect(ctx, 800, 114, 158, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('DEMO', 844, 146);
  }

  // Hero row: Score ring (left) + 7-day trend & status (right)
  const cx = 275;
  const cy = 345;
  const r = 128;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#323848';
  ctx.lineWidth = 22;
  ctx.stroke();

  if (summary.score !== null) {
    const start = -Math.PI / 2;
    const end = start + (Math.PI * 2 * summary.score) / 100;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.strokeStyle = '#35CFC8';
    ctx.lineCap = 'round';
    ctx.lineWidth = 22;
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#F4F5F7';
  ctx.font = '800 84px system-ui, -apple-system, sans-serif';
  ctx.fillText(summary.score !== null ? `${summary.score}` : '—', cx, cy + 22);
  ctx.fillStyle = '#A8AFBD';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('BALANCE SCORE', cx, cy + 60);

  // Right side of hero: Status + 7-day mini bars
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F4F5F7';
  ctx.font = '700 42px system-ui, -apple-system, sans-serif';
  ctx.fillText(summary.statusLabel, 455, 275);
  ctx.fillStyle = '#A8AFBD';
  ctx.font = '500 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    summary.goalsTotal > 0 ? `${summary.goalsMet} of ${summary.goalsTotal} weekly goals on track` : '7-day Balance trend',
    455,
    315,
  );

  // 7-day score bars box
  ctx.fillStyle = '#262B38';
  ctx.strokeStyle = '#3E4759';
  ctx.lineWidth = 2;
  roundRect(ctx, 455, 342, 505, 130, 22);
  ctx.fill();
  ctx.stroke();

  const bars = summary.weekScores.length ? summary.weekScores : [0];
  const barW = 42;
  const barGap = 22;
  const startX = 486;
  const baseBottom = 448;
  bars.forEach((sc, idx) => {
    const bh = Math.max(12, Math.round((sc / 100) * 76));
    const bx = startX + idx * (barW + barGap);
    ctx.fillStyle = idx === bars.length - 1 ? '#35CFC8' : 'rgba(53, 207, 200, 0.45)';
    roundRect(ctx, bx, baseBottom - bh, barW, bh, 10);
    ctx.fill();
  });

  // 4-tile Weekly Averages grid (2x2)
  const tiles: { label: string; value: string; accent: string }[] = [
    { label: 'AVG SLEEP', value: summary.avgSleepHours !== null ? `${summary.avgSleepHours.toFixed(1)} h` : '—', accent: '#8974E8' },
    { label: 'AVG STEPS', value: summary.avgSteps !== null ? summary.avgSteps.toLocaleString() : '—', accent: '#438CCB' },
    { label: 'AVG SCREEN', value: summary.avgScreenHours !== null ? `${summary.avgScreenHours.toFixed(1)} h` : '—', accent: '#F04460' },
    { label: 'AVG MOOD', value: summary.avgMood !== null ? `${summary.avgMood.toFixed(1)} / 5` : '—', accent: '#35CFC8' },
  ];

  tiles.forEach((tile, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const tx = 120 + col * 432;
    const ty = 528 + row * 164;
    ctx.fillStyle = '#262B38';
    ctx.strokeStyle = '#3E4759';
    ctx.lineWidth = 2;
    roundRect(ctx, tx, ty, 408, 142, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tile.accent;
    roundRect(ctx, tx + 24, ty + 28, 10, 86, 5);
    ctx.fill();

    ctx.fillStyle = '#A8AFBD';
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(tile.label, tx + 52, ty + 56);

    ctx.fillStyle = '#F4F5F7';
    ctx.font = '800 46px system-ui, -apple-system, sans-serif';
    ctx.fillText(tile.value, tx + 52, ty + 110);
  });

  // Streak & Top Win boxes
  ctx.fillStyle = '#262B38';
  ctx.strokeStyle = '#3E4759';
  ctx.lineWidth = 2;
  roundRect(ctx, 120, 872, 840, 126, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#A8AFBD';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('ACTIVE STREAK', 156, 918);
  ctx.fillStyle = '#F4F5F7';
  ctx.font = '700 36px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    summary.streakDays > 0 ? `${summary.streakDays}-day ${summary.streakLabel}` : 'Building consistency',
    156,
    968,
  );

  ctx.fillStyle = '#262B38';
  roundRect(ctx, 120, 1020, 840, 126, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#A8AFBD';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOP WIN THIS WEEK', 156, 1066);
  ctx.fillStyle = '#34D399';
  ctx.font = '700 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(summary.topWin, 156, 1116, 768);

  // Privacy footer
  ctx.fillStyle = '#A8AFBD';
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Week ending ${summary.date} · Sensitive health & app logs stripped`, 120, 1226);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not export PNG summary card.'));
    }, 'image/png');
  });
}

export async function downloadSummaryCard(summary: PrivacySafeSummary): Promise<void> {
  const blob = await renderSummaryCardPng(summary);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aura-weekly-${summary.date}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
