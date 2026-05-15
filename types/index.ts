export interface VocabItem {
  italian: string;
  english: string;
  example?: string;
  activelyUsed?: boolean;
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

export interface GrammarCorrection {
  original: string;
  corrected: string;
  explanation: string;
}

export interface SessionFeedback {
  praise: string;
  tip: string;
  corrections: GrammarCorrection[];
  patternsGood: string[];
  patternsToImprove: string[];
}

export interface ConversationSession {
  id: string;
  scenarioId: string;
  userId: string;
  turns: ConversationTurn[];
  startedAt: number;
  endedAt?: number;
  newVocabulary: VocabItem[];
  feedback?: SessionFeedback;
}

export interface SidekickMessage {
  question: string;
  answer: string;
  timestamp: number;
}

export interface CapturedAudio {
  data: string;
  mimeType: string;
}

// WebSocket message types between app and Cloud Run relay
export type WsClientMessage =
  | { type: "start"; scenarioId: string; scenario: Scenario }
  | { type: "talk_start" }
  | { type: "talk_end"; audio: CapturedAudio }
  | { type: "talk_cancel" }
  | { type: "end" };

export type WsServerMessage =
  | { type: "ready" }
  | { type: "audio"; data: string; mimeType?: string }
  | { type: "transcript"; role: "user" | "assistant"; text: string; italian: string }
  | { type: "transcript_partial"; italian: string } // streaming word-by-word from model
  | { type: "vocab_hint"; item: VocabItem }
  | { type: "interrupt" }
  | { type: "turn_error"; message: string }
  | { type: "error"; message: string };
