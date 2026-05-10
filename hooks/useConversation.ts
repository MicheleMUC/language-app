import { useState, useRef, useCallback } from "react";
import { useAudioPlayer } from "expo-audio";
import { ConversationSocket } from "@/lib/websocket";
import { useAudioCapture } from "./useAudioCapture";
import type { ConversationTurn, Scenario, VocabItem, WsServerMessage } from "@/types";

type Status = "idle" | "connecting" | "active" | "paused" | "ended";

export function useConversation(scenario: Scenario) {
  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [activeVocab, setActiveVocab] = useState<VocabItem | null>(null);
  const socketRef = useRef<ConversationSocket | null>(null);
  const player = useAudioPlayer(null);

  const playAudioChunk = useCallback(async (base64: string) => {
    try {
      player.replace({ uri: `data:audio/pcm;base64,${base64}` });
      player.play();
    } catch {
      // audio playback errors are non-fatal
    }
  }, [player]);

  const handleMessage = useCallback(
    (msg: WsServerMessage) => {
      switch (msg.type) {
        case "ready":
          setStatus("active");
          break;
        case "audio":
          playAudioChunk(msg.data);
          break;
        case "transcript":
          setTurns((prev) => [
            ...prev,
            {
              role: msg.role,
              italian: msg.italian,
              english: msg.text,
              timestamp: Date.now(),
            },
          ]);
          break;
        case "vocab_hint":
          setActiveVocab(msg.item);
          setTimeout(() => setActiveVocab(null), 4000);
          break;
        case "paused":
          setStatus("paused");
          break;
        case "resumed":
          setStatus("active");
          break;
      }
    },
    [playAudioChunk]
  );

  const { start: startCapture, stop: stopCapture } = useAudioCapture(
    useCallback(
      (base64: string) => {
        if (status === "active") socketRef.current?.sendAudio(base64);
      },
      [status]
    )
  );

  const start = useCallback(async () => {
    setStatus("connecting");
    const socket = new ConversationSocket(handleMessage, () => setStatus("ended"));
    socketRef.current = socket;
    await socket.connect();
    socket.send({ type: "start", scenarioId: scenario.id, scenario });
    await startCapture();
  }, [scenario, handleMessage, startCapture]);

  const pause = useCallback(() => {
    socketRef.current?.send({ type: "pause" });
    stopCapture();
  }, [stopCapture]);

  const resume = useCallback(async () => {
    socketRef.current?.send({ type: "resume" });
    await startCapture();
  }, [startCapture]);

  const end = useCallback(async () => {
    socketRef.current?.send({ type: "end" });
    await stopCapture();
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("ended");
  }, [stopCapture]);

  return { status, turns, activeVocab, start, pause, resume, end };
}
