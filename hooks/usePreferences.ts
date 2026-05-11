import { useEffect, useState, useCallback } from "react";
import { loadPreferences, savePreferences } from "@/lib/supabase";

export function usePreferences(userId: string | undefined) {
  const [level, setLevel] = useState("A2");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    loadPreferences(userId)
      .then((saved) => { if (saved) setLevel(saved); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const updateLevel = useCallback(
    async (newLevel: string) => {
      setLevel(newLevel);
      if (userId) await savePreferences(userId, newLevel).catch(() => {});
    },
    [userId]
  );

  return { level, loading, updateLevel };
}
