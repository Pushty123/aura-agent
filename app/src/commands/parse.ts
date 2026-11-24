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
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && hour < 12) hour += 12;
  if (ap === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  // A bare "3:30" with no am/pm is taken as written (24-hour), which is the safe literal reading.
  return { hour, minute };
}

const two = (n: number) => String(n).padStart(2, '0');

export function parseCommand(input: string, todayIso: string): Command {
  const text = input.trim();
  const lower = text.toLowerCase();

  if (/\b(alarm|wake me)\b/.test(lower)) {
    const t = parseTime(lower.replace(/\b(alarm|wake me|set|for|at|an|a)\b/g, ' '));
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
          .replace(/\b(add|create|schedule|an?|event|meeting|reminder|remind me|tomorrow|today|at|to|on|for)\b/gi, ' ')
          .replace(/\d{1,2}(:\d{2})?\s*(am|pm)?/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim() || 'AURA event';
      return { type: 'event', title, date, ...t, summary: `Add "${title}" on ${date} at ${two(t.hour)}:${two(t.minute)}` };
    }
  }

  return { type: 'unknown', summary: 'Sorry, I can only set alarms and add calendar events for now. Try "set an alarm for 6:30 am".' };
}
