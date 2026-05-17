import { useState, useEffect } from "react";
import { loadLearnerProfile } from "@/lib/supabase";
import type { LearnerProfile } from "@/types";

export function useLearnerProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadLearnerProfile(userId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return { profile, loading };
}
