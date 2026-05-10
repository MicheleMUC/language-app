import Constants from "expo-constants";
import type { Scenario } from "@/types";

function getServerBase(): string {
  if (process.env.EXPO_PUBLIC_SERVER_URL) return process.env.EXPO_PUBLIC_SERVER_URL;
  // In Expo dev, hostUri is the Metro bundler address e.g. "192.168.1.10:8081"
  // We use the same LAN IP but on port 3001 where our server listens.
  const host = (Constants.expoConfig?.hostUri ?? "localhost:8081").split(":")[0];
  return `http://${host}:3001`;
}

export async function generateScenario(intent: string, userId: string): Promise<Scenario> {
  const base = getServerBase();
  const res = await fetch(`${base}/scenario`, {
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
