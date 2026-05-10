import { useState, useCallback } from "react";
import { querySidekick } from "@/lib/api";
import type { ConversationTurn, Scenario, SidekickMessage } from "@/types";

export function useSidekick(scenario: Scenario, turns: ConversationTurn[]) {
  const [messages, setMessages] = useState<SidekickMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = useCallback(
    async (question: string) => {
      setLoading(true);
      try {
        const recentTurns = turns.slice(-10).map((t) => ({
          role: t.role,
          italian: t.italian,
          english: t.english,
        }));
        const answer = await querySidekick(question, recentTurns, scenario);
        setMessages((prev) => [...prev, { question, answer, timestamp: Date.now() }]);
      } finally {
        setLoading(false);
      }
    },
    [scenario, turns]
  );

  return { messages, loading, ask };
}
