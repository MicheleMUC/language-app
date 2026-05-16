import Constants from "expo-constants";
import type { Scenario, ConversationTurn, SessionFeedback, TurnFeedback } from "@/types";

function getServerBase(): string {
  if (process.env.EXPO_PUBLIC_SERVER_URL) return process.env.EXPO_PUBLIC_SERVER_URL;
  const host = (Constants.expoConfig?.hostUri ?? "localhost:8081").split(":")[0];
  return `http://${host}:3001`;
}

export async function generateScenario(
  intent: string,
  userId: string,
  difficulty?: string,
  memory?: { recentVocab?: string[]; lastTip?: string }
): Promise<Scenario> {
  const base = getServerBase();
  const res = await fetch(`${base}/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, userId, difficulty, ...memory }),
  });
  if (!res.ok) throw new Error(`Scenario generation failed: ${res.status}`);
  return res.json();
}

export async function querySidekick(
  question: string,
  recentTurns: Array<{ role: string; italian: string; english?: string }>,
  scenario: Scenario
): Promise<string> {
  const base = getServerBase();
  const res = await fetch(`${base}/sidekick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, recentTurns, scenario }),
  });
  if (!res.ok) throw new Error(`Sidekick query failed: ${res.status}`);
  const data = await res.json();
  return data.answer as string;
}

export async function requestTurnFeedback(
  italian: string,
  scenario: { difficulty: string; characterName: string },
  userLevel: string
): Promise<TurnFeedback> {
  const base = getServerBase();
  const res = await fetch(`${base}/feedback/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ italian, scenario, userLevel }),
  });
  if (!res.ok) return { ok: true };
  return res.json();
}

export async function requestFeedback(
  turns: ConversationTurn[],
  scenario: { difficulty: string; characterName: string },
  userLevel: string
): Promise<SessionFeedback> {
  const base = getServerBase();
  const res = await fetch(`${base}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turns, scenario, userLevel }),
  });
  if (!res.ok) throw new Error(`Feedback failed: ${res.status}`);
  return res.json();
}
