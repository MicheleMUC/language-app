import type { Scenario } from "@/types";

const BASE_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://localhost:3001";

export async function generateScenario(intent: string, userId: string): Promise<Scenario> {
  const res = await fetch(`${BASE_URL}/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, userId }),
  });
  if (!res.ok) throw new Error(`Scenario generation failed: ${res.status}`);
  return res.json();
}

export async function querySidekick(
  question: string,
  recentTurns: Array<{ role: string; italian: string; english?: string }>,
  scenario: Scenario
): Promise<string> {
  const res = await fetch(`${BASE_URL}/sidekick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, recentTurns, scenario }),
  });
  if (!res.ok) throw new Error(`Sidekick query failed: ${res.status}`);
  const data = await res.json();
  return data.answer as string;
}
