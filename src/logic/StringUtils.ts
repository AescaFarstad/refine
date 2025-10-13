// Shared string formatting utilities

/**
 * Format a duration in seconds as a compact human-readable string.
 * - Uses days when >= 24h: e.g., "4d 18h 39m"
 * - Otherwise uses hours/minutes: e.g., "2h 5m", "25m"
 * - Rounds up to avoid under-reporting (e.g., 1–60s -> 1m, 100s -> 2m)
 * - Examples: 0 -> "0m", 59 -> "1m", 60 -> "1m", 3600 -> "1h"
 */
export function formatDurationHM(seconds?: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  if (s <= 0) return '0m';
  const totalMin = Math.ceil(s / 60);
  const d = Math.floor(totalMin / (60 * 24));
  const remAfterDays = totalMin - d * 60 * 24;
  const h = Math.floor(remAfterDays / 60);
  const m = remAfterDays % 60;

  if (d > 0) {
    const parts: string[] = [];
    parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(' ');
  }

  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
