import { addDays } from '../lib/dates';

/**
 * Typed commands -> structured intents. AURA never acts on its own: every command
 * becomes a confirm card, and nothing happens until the user taps Confirm.
 */
export type Command =
  | { type: 'alarm'; hour: number; minute: number; label: string; summary: string }
  | { type: 'event'; title: string; date: string; hour: number; minute: number; summary: string }
  | { type: 'unknown'; summary: string };

function parseTime(text: string): { hour: number; minute: number } | null {
  const m = text.match(
    /\b(?:at|for)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  );
  if (!m) return null;
  let hour = Number(m[1] ?? m[4]);
  const minute = Number(m[2] ?? m[5] ?? 0);
  const ap = (m[3] ?? m[6])?.toLowerCase();
  if (ap && (hour < 1 || hour > 12)) return null;
  if (ap === 'pm' && hour < 12) hour += 12;
  if (ap === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  // A time without am/pm is interpreted literally in 24-hour time.
  return { hour, minute };
}

const two = (n: number) => String(n).padStart(2, '0');

function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function unknownCommand(): Command {
  return { type: 'unknown', summary: 'Sorry, I can only set alarms and add calendar events for now. Try "set an alarm for 6:30 am".' };
}

export function parseCommand(input: string, todayIso: string): Command {
  if (typeof input !== 'string' || typeof todayIso !== 'string' || !isValidIsoDate(todayIso)) {
    return unknownCommand();
  }

  const text = input.trim();
  const lower = text.toLowerCase();

  if (/\b(alarm|wake me)\b/.test(lower)) {
    const t = parseTime(lower);
    if (t) {
      return { type: 'alarm', ...t, label: 'AURA', summary: `Set an alarm for ${two(t.hour)}:${two(t.minute)}` };
    }
  }

  if (/\b(add|create|schedule)\b.*\b(event|meeting|reminder|class|session)\b|\bremind me\b/.test(lower)) {
    const t = parseTime(lower);
    if (t) {
      const date = /\btomorrow\b/.test(lower) ? addDays(todayIso, 1) : todayIso;
      const title =
        text
          .replace(/^\s*(?:(?:please\s+)?(?:add|create|schedule)|remind\s+me)\b/i, ' ')
          .replace(/\b(?:a|an|the|event|reminder|tomorrow|today|at|to|on|for)\b/gi, ' ')
          .replace(/\d{1,2}(:\d{2})?\s*(am|pm)?/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim() || 'AURA event';
      return { type: 'event', title, date, ...t, summary: `Add "${title}" on ${date} at ${two(t.hour)}:${two(t.minute)}` };
    }
  }

  return unknownCommand();
}
