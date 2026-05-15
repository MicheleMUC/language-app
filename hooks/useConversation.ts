import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { ConversationSocket } from "@/lib/websocket";
import { useAudioCapture } from "./useAudioCapture";
import type { ConversationTurn, Scenario, VocabItem, WsServerMessage } from "@/types";

type Status = "idle" | "connecting" | "active" | "thinking" | "talking" | "ended";

export function useConversation(scenario: Scenario) {
  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [lastUserTranscript, setLastUserTranscript] = useState("");
  const [activeVocab, setActiveVocab] = useState<VocabItem | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const socketRef = useRef<ConversationSocket | null>(null);
  const startedRef = useRef(false); // guard against Strict Mode double-invocation
  const startTokenRef = useRef(0);
  const talkEndTimeRef = useRef(0);
  const firstAudioAfterTalkRef = useRef(false);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  // Audio queue for gapless sequential playback of streamed chunks
  const audioQueueRef = useRef<Array<{ uri: string }>>([]);
  const isDrainingRef = useRef(false);

  // Ref-based drain avoids stale-closure issues with self-reference
  const drainQueueRef = useRef<() => void>(() => {});
  drainQueueRef.current = () => {
    if (isDrainingRef.current) return;
    const next = audioQueueRef.current.shift();
    if (!next) return;
    console.log(`[conv] drainQueue: playing chunk, queue remaining=${audioQueueRef.current.length}`);
    isDrainingRef.current = true;
    try {
      player.replace(next);
      player.play();
    } catch (e) {
      console.error("[conv] drainQueue player error:", e);
      isDrainingRef.current = false;
      drainQueueRef.current();
    }
  };
  const drainQueue = useCallback(() => drainQueueRef.current(), []);

  // Advance queue when current chunk finishes playing
  useEffect(() => {
    if (!playerStatus.playing) {
      isDrainingRef.current = false;
      drainQueue();
    }
  }, [playerStatus.playing, drainQueue]);

  const playAudio = useCallback((base64: string, mimeType = "audio/wav") => {
    audioQueueRef.current.push({ uri: `data:${mimeType};base64,${base64}` });
    drainQueue();
  }, [drainQueue]);

  const handleMessage = useCallback(
    (msg: WsServerMessage) => {
      console.log(`[conv] ws msg type=${msg.type}`, msg.type === "audio" ? `(${Math.round((msg.data?.length ?? 0) * 0.75)} bytes)` : msg.type === "transcript" ? `role=${msg.role} text="${msg.italian?.slice(0, 40)}"` : "");
      switch (msg.type) {
        case "ready":
          // Only advance from "connecting" — never overwrite "thinking" or later states
          // from a stale/duplicate socket that connected late.
          setStatus((prev) => (prev === "connecting" ? "active" : prev));
          break;
        case "audio":
          if (firstAudioAfterTalkRef.current) {
            firstAudioAfterTalkRef.current = false;
            const latency = Date.now() - talkEndTimeRef.current;
            if (latency > 0 && latency < 30000) setLastLatencyMs(latency);
          }
          setStatus((prev) => {
            if (prev === "thinking") console.log("[conv] status: thinking → active (audio)");
            return prev === "thinking" ? "active" : prev;
          });
          playAudio(msg.data, msg.mimeType ?? "audio/wav");
          break;
        case "transcript":
          if (msg.role === "user") {
            setLastUserTranscript(msg.italian);
          } else {
            setPartialTranscript("");
            setStatus((prev) => {
              if (prev === "thinking") console.log("[conv] status: thinking → active (transcript)");
              return prev === "thinking" ? "active" : prev;
            });
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
          audioQueueRef.current = [];
          isDrainingRef.current = false;
          try { player.pause(); } catch { /* ignore */ }
          setPartialTranscript("");
          break;
        case "turn_error":
          console.warn("[conv] turn error:", msg.message);
          setPartialTranscript("");
          setStatus("active");
          break;
        case "error":
          console.error("[conv] server error:", (msg as { type: "error"; message?: string }).message);
          setStatus("ended");
          break;
      }
    },
    [playAudio, player]
  );

  // Close socket on unmount so Strict Mode's unmount/remount doesn't leave orphan connections
  useEffect(() => {
    return () => {
      startTokenRef.current++;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  const { start: startCapture, stop: stopCapture } = useAudioCapture();

  const start = useCallback(async () => {
    if (startedRef.current) {
      console.warn("[conv] start() called again — ignoring duplicate (Strict Mode?)");
      return;
    }
    startedRef.current = true;
    const startToken = ++startTokenRef.current;
    // Close any stale socket from a previous attempt
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus("connecting");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
    const socket = new ConversationSocket(handleMessage, () => setStatus("ended"));
    socketRef.current = socket;
    await socket.connect();
    if (startToken !== startTokenRef.current || socketRef.current !== socket || !socket.isOpen()) {
      console.warn("[conv] start() resolved after cleanup — closing stale socket");
      socket.close();
      return;
    }
    socket.send({ type: "start", scenarioId: scenario.id, scenario });
  }, [scenario, handleMessage]);

  const startTalking = useCallback(async () => {
    if (!socketRef.current) return;
    try {
      await startCapture();
      socketRef.current?.send({ type: "talk_start" });
      setStatus("talking");
      setLastUserTranscript(""); // clear previous "Ho sentito" while speaking
    } catch (e) {
      console.error("[conv] startTalking capture error:", e);
      setStatus("active");
    }
  }, [startCapture]);

  const stopTalking = useCallback(async () => {
    setStatus("thinking");
    talkEndTimeRef.current = Date.now();
    firstAudioAfterTalkRef.current = true;
    const audio = await stopCapture();

    if (!audio) {
      console.warn("[conv] stopTalking → no audio captured, cancelling turn");
      socketRef.current?.send({ type: "talk_cancel" });
      setStatus("active");
      return;
    }

    console.log(`[conv] stopTalking → sending talk_end (${Math.round(audio.data.length * 0.75)} bytes), status → thinking`);
    socketRef.current?.send({ type: "talk_end", audio });
  }, [stopCapture]);

  const end = useCallback(async () => {
    audioQueueRef.current = [];
    isDrainingRef.current = false;
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
    lastLatencyMs,
    isModelSpeaking: playerStatus.playing,
    start,
    startTalking,
    stopTalking,
    end,
  };
}
