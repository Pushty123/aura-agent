export interface PrivacySafeSummary {
  score: number | null;
  streakLabel: string;
  streakDays: number;
  topWin: string;
  date: string;
  isDemo: boolean;
}

/**
 * Builds a privacy-safe summary containing only aggregate score, streak,
 * and top win — never symptoms, period logs, app names, or personal identifiers.
 */
export function buildPrivacySafeSummary(input: {
  score?: number | null;
  streakLabel?: string;
  streakDays?: number;
  topWin?: string;
  date: string;
  isDemo?: boolean;
}): PrivacySafeSummary {
  const safeScore = typeof input.score === 'number' ? Math.max(0, Math.min(100, Math.round(input.score))) : null;
  const safeDays = typeof input.streakDays === 'number' && input.streakDays > 0 ? Math.round(input.streakDays) : 0;
  return {
    score: safeScore,
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

/** Renders a clean 1080x1080 PNG card 100% on-device using HTML5 Canvas. */
export async function renderSummaryCardPng(summary: PrivacySafeSummary): Promise<Blob> {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');

  // Background gradient
  const bg = ctx.createRadialGradient(540, 180, 60, 540, 540, 760);
  bg.addColorStop(0, '#12332F');
  bg.addColorStop(0.55, '#0B1716');
  bg.addColorStop(1, '#070F0D');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Outer card
  ctx.fillStyle = '#1F212C';
  ctx.strokeStyle = '#384152';
  ctx.lineWidth = 3;
  roundRect(ctx, 72, 72, size - 144, size - 144, 44);
  ctx.fill();
  ctx.stroke();

  // Header
  ctx.fillStyle = '#35CFC8';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('AURA · WEEKLY SNAPSHOT', 132, 160);

  if (summary.isDemo) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
    roundRect(ctx, 790, 124, 158, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('DEMO', 834, 156);
  }

  // Score ring
  const cx = 540;
  const cy = 410;
  const r = 155;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#323848';
  ctx.lineWidth = 26;
  ctx.stroke();

  if (summary.score !== null) {
    const start = -Math.PI / 2;
    const end = start + (Math.PI * 2 * summary.score) / 100;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.strokeStyle = '#35CFC8';
    ctx.lineCap = 'round';
    ctx.lineWidth = 26;
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#F4F5F7';
  ctx.font = '800 96px system-ui, -apple-system, sans-serif';
  ctx.fillText(summary.score !== null ? `${summary.score}` : '—', cx, cy + 26);
  ctx.fillStyle = '#A8AFBD';
  ctx.font = '600 26px system-ui, -apple-system, sans-serif';
  ctx.fillText('BALANCE SCORE', cx, cy + 70);

  // Streak & Top Win boxes
  ctx.textAlign = 'left';
  ctx.fillStyle = '#262B38';
  ctx.strokeStyle = '#3E4759';
  ctx.lineWidth = 2;
  roundRect(ctx, 132, 635, 816, 126, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#A8AFBD';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('STREAK', 168, 682);
  ctx.fillStyle = '#F4F5F7';
  ctx.font = '700 36px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    summary.streakDays > 0 ? `${summary.streakDays}-day ${summary.streakLabel}` : 'Building consistency',
    168,
    732,
  );

  ctx.fillStyle = '#262B38';
  roundRect(ctx, 132, 785, 816, 126, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#A8AFBD';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOP WIN', 168, 832);
  ctx.fillStyle = '#34D399';
  ctx.font = '700 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(summary.topWin, 168, 882, 744);

  // Privacy footer
  ctx.fillStyle = '#A8AFBD';
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Week ending ${summary.date} · Sensitive health & app logs stripped`, 132, 972);

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
