import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadPreferences, savePreferences } from "@/lib/supabase";
import type { FeedbackLayers } from "@/types";

const FEEDBACK_LAYERS_KEY = "@litaliano/feedbackLayers";

const DEFAULT_FEEDBACK_LAYERS: FeedbackLayers = {
  microfeedback: true,
  endSession: true,
  naturalCorrection: true,
};

export function usePreferences(userId: string | undefined) {
  const [level, setLevel] = useState("A2");
  const [feedbackLayers, setFeedbackLayers] = useState<FeedbackLayers>(DEFAULT_FEEDBACK_LAYERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        if (userId) {
          const saved = await loadPreferences(userId).catch(() => null);
          if (saved) setLevel(saved);
        }
        const raw = await AsyncStorage.getItem(FEEDBACK_LAYERS_KEY);
        if (raw) setFeedbackLayers({ ...DEFAULT_FEEDBACK_LAYERS, ...JSON.parse(raw) });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [userId]);

  const updateLevel = useCallback(
    async (newLevel: string) => {
      setLevel(newLevel);
      if (userId) await savePreferences(userId, newLevel).catch(() => {});
    },
    [userId]
  );

  const updateFeedbackLayer = useCallback(
    async (key: keyof FeedbackLayers, value: boolean) => {
      setFeedbackLayers((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(FEEDBACK_LAYERS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  return { level, feedbackLayers, loading, updateLevel, updateFeedbackLayer };
}
