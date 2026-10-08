// Bill history, kept only in this browser (localStorage). Numbers only: never the bill, name or address.
// Storage can be blocked (private mode), so every read/write is wrapped and the app works without it.
export type HistoryEntry = {
  periodStart: string;
  periodEnd: string;
  kgCo2e: number;
  kgPer30Days: number; // normalized so bills of different lengths compare fairly
};

const KEY = "billprint-history-v1";

export function loadHistory(): HistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Adds (or replaces) this billing period and returns the history sorted oldest -> newest. */
export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  const others = loadHistory().filter((h) => !(h.periodStart === entry.periodStart && h.periodEnd === entry.periodEnd));
  const history = [...others, entry].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  try {
    localStorage.setItem(KEY, JSON.stringify(history));
  } catch {
    // storage blocked: keep going with the in-memory history
  }
  return history;
}

/** Consecutive months tracked, counting back from the newest bill (by the month each bill ends in). */
export function monthStreak(history: HistoryEntry[]): number {
  const months = [...new Set(history.map((h) => h.periodEnd.slice(0, 7)))].sort().reverse();
  let streak = months.length > 0 ? 1 : 0;
  for (let i = 1; i < months.length; i++) {
    const [y, m] = months[i - 1].split("-").map(Number);
    const previous = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    if (months[i] !== previous) break;
    streak++;
  }
  return streak;
}
