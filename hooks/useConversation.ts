import { useState, useRef, useCallback } from "react";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { ConversationSocket } from "@/lib/websocket";
import { useAudioCapture } from "./useAudioCapture";
import type { ConversationTurn, Scenario, VocabItem, WsServerMessage } from "@/types";

type Status = "idle" | "connecting" | "active" | "talking" | "ended";

export function useConversation(scenario: Scenario) {
  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [lastUserTranscript, setLastUserTranscript] = useState("");
  const [activeVocab, setActiveVocab] = useState<VocabItem | null>(null);
  const socketRef = useRef<ConversationSocket | null>(null);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  const playAudio = useCallback(async (base64: string, mimeType = "audio/wav") => {
    try {
      player.replace({ uri: `data:${mimeType};base64,${base64}` });
      player.play();
    } catch {
      // non-fatal
    }
  }, [player]);

  const handleMessage = useCallback(
    (msg: WsServerMessage) => {
      switch (msg.type) {
        case "ready":
          setStatus("active");
          break;
        case "audio":
          playAudio(msg.data, msg.mimeType ?? "audio/wav");
          break;
        case "transcript":
          if (msg.role === "user") {
            setLastUserTranscript(msg.italian);
          } else {
            setPartialTranscript(""); // clear partial when final arrives
          }
          setTurns((prev) => [
            ...prev,
            { role: msg.role, italian: msg.italian, english: msg.text, timestamp: Date.now() },
          ]);
          break;
        case "transcript_partial":
          setPartialTranscript(msg.italian);
          break;
        case "vocab_hint":
          setActiveVocab(msg.item);
          setTimeout(() => setActiveVocab(null), 4000);
          break;
        case "interrupt":
          try { player.pause(); } catch { /* ignore */ }
          setPartialTranscript("");
          break;
      }
    },
    [playAudio, player]
  );

  const { start: startCapture, stop: stopCapture } = useAudioCapture(
    useCallback((base64: string, mimeType: string) => {
      socketRef.current?.sendAudio(base64, mimeType);
    }, [])
  );

  const start = useCallback(async () => {
    setStatus("connecting");
    // Allow simultaneous recording + playback. On iOS this switches the
    // AVAudioSession to PlayAndRecord — without it the recorder is interrupted
    // the moment the model's audio starts playing.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
    const socket = new ConversationSocket(handleMessage, () => setStatus("ended"));
    socketRef.current = socket;
    await socket.connect();
    socket.send({ type: "start", scenarioId: scenario.id, scenario });
  }, [scenario, handleMessage]);

  const startTalking = useCallback(async () => {
    if (!socketRef.current) return;
    socketRef.current.send({ type: "talk_start" });
    setStatus("talking");
    setLastUserTranscript(""); // clear previous "Ho sentito" while speaking
    await startCapture();
  }, [startCapture]);

  const stopTalking = useCallback(async () => {
    await stopCapture();
    socketRef.current?.send({ type: "talk_end" });
    setStatus("active");
  }, [stopCapture]);

  const end = useCallback(async () => {
    await stopCapture();
    socketRef.current?.send({ type: "end" });
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("ended");
  }, [stopCapture]);

  return {
    status,
    turns,
    partialTranscript,
    lastUserTranscript,
    activeVocab,
    isModelSpeaking: playerStatus.playing,
    start,
    startTalking,
    stopTalking,
    end,
  };
}
