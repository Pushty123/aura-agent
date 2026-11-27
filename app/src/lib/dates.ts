/** Date helpers working on ISO YYYY-MM-DD strings (UTC arithmetic, so no timezone surprises). */

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return isoDate(new Date());
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** "Today", "Yesterday", or a short readable date like "Mon, 24 Nov". */
export function friendlyDate(iso: string): string {
  if (iso === today()) return 'Today';
  if (iso === addDays(today(), -1)) return 'Yesterday';
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
