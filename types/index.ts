export interface VocabItem {
  italian: string;
  english: string;
  example?: string;
}

export interface Scenario {
  id: string;
  intent: string;
  characterName: string;
  characterDescription: string;
  setting: string;
  difficulty: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  vocabulary: VocabItem[];
  likelyPhrases: string[];
  createdAt: number;
  userId: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  italian: string;
  english?: string;
  timestamp: number;
}

export interface ConversationSession {
  id: string;
  scenarioId: string;
  userId: string;
  turns: ConversationTurn[];
  startedAt: number;
  endedAt?: number;
  newVocabulary: VocabItem[];
}

export interface SidekickMessage {
  question: string;
  answer: string;
  timestamp: number;
}

// WebSocket message types between app and Cloud Run relay
export type WsClientMessage =
  | { type: "start"; scenarioId: string; scenario: Scenario }
  | { type: "audio"; data: string } // base64 PCM16
  | { type: "talk_end" }            // user released mic
  | { type: "end" };

export type WsServerMessage =
  | { type: "ready" }
  | { type: "audio"; data: string; mimeType?: string } // base64 audio from Gemini
  | { type: "transcript"; role: "user" | "assistant"; text: string; italian: string }
  | { type: "vocab_hint"; item: VocabItem }
  | { type: "error"; message: string };
