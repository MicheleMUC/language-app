import { useEffect, useState } from "react";
import { loadSessionStats } from "@/lib/supabase";

type Stats = {
  streak: number;
  todayMinutes: number;
  totalSessions: number;
  loading: boolean;
};

function prevDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d - 1).toLocaleDateString("en-CA");
}

function computeStreak(rows: Array<{ startedAt: number }>): number {
  if (rows.length === 0) return 0;
  const dates = new Set(rows.map((r) => new Date(r.startedAt).toLocaleDateString("en-CA")));
  const today = new Date().toLocaleDateString("en-CA");
  const yesterday = prevDate(today);

  let check = dates.has(today) ? today : dates.has(yesterday) ? yesterday : null;
  if (!check) return 0;

  let streak = 0;
  while (dates.has(check)) {
    streak++;
    check = prevDate(check);
  }
  return streak;
}

export function useStats(userId: string | undefined): Stats {
  const [stats, setStats] = useState<Stats>({
    streak: 0,
    todayMinutes: 0,
    totalSessions: 0,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setStats((s) => ({ ...s, loading: false }));
      return;
    }
    loadSessionStats(userId)
      .then((rows) => {
        const today = new Date().toLocaleDateString("en-CA");
        const todayMs = rows
          .filter((r) => new Date(r.startedAt).toLocaleDateString("en-CA") === today)
          .reduce((sum, r) => sum + (r.endedAt - r.startedAt), 0);
        setStats({
          streak: computeStreak(rows),
          todayMinutes: Math.round(todayMs / 60000),
          totalSessions: rows.length,
          loading: false,
        });
      })
      .catch(() => setStats((s) => ({ ...s, loading: false })));
  }, [userId]);

  return stats;
}
