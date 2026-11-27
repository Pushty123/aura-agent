/** Stable positive 31-bit notification id per reminder and slot. */
export function notificationId(reminderId: string, slot: number): number {
  let hash = 2166136261;
  for (const char of `${reminderId}#${slot}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return ((hash >>> 1) % 2_000_000_000) + 1000;
}
