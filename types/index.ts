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

export interface TurnFeedback {
  ok: boolean;
  correction?: {
    original: string;
    corrected: string;
    explanation: string;
  };
  praise?: string;
}

export interface FeedbackLayers {
  microfeedback: boolean;
  endSession: boolean;
  naturalCorrection: boolean;
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

// Learner profile types
export type GrammarCategory =
  | "passato_prossimo"
  | "subjunctive"
  | "gender_agreement"
  | "pronoun_order"
  | "future_tense"
  | "conditional"
  | "other";

export interface VocabEntry {
  word: string;
  seen_count: number;
}

export type WeaknessMap = Partial<Record<GrammarCategory, number>>; // score 0-1, higher = stronger

export interface UserContext {
  name?: string;
  occupation?: string;
  topics_mentioned?: string[];
  last_session?: string;
  conversation_count?: number;
}

export interface LearnerProfile {
  userId: string;
  weaknessMap: WeaknessMap;
  strongPatterns: string[];
  vocabToReuse: VocabEntry[];
  userContext: UserContext;
  updatedAt: string;
}

export interface LearnerContext {
  userContext: UserContext;
  vocabToReuse: VocabEntry[];
  weaknessMap: WeaknessMap;
}

// WebSocket message types between app and Cloud Run relay
export type WsClientMessage =
  | { type: "start"; scenarioId: string; scenario: Scenario; preferences?: { naturalCorrection?: boolean }; learnerContext?: LearnerContext; sessionGoal?: string }
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
