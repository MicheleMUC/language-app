import { useState, useEffect, useCallback } from "react";
import { loadActiveGoal, markScenarioComplete } from "@/lib/supabase";
import type { LearningGoal } from "@/types";

export function useGoal(userId: string | undefined) {
  const [goal, setGoal] = useState<LearningGoal | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!userId) { setLoading(false); return; }
    loadActiveGoal(userId)
      .then(setGoal)
      .catch(() => setGoal(null))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const completeScenario = useCallback(async (intent: string) => {
    if (!goal) return;
    await markScenarioComplete(goal.id, intent).catch(() => {});
    setGoal((g) => g ? { ...g, completedIntents: [...g.completedIntents, intent] } : g);
  }, [goal]);

  return { goal, loading, refresh, completeScenario };
}
