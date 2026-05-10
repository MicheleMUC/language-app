import { useRef, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { useAudioRecorder, AudioModule, AudioQuality, IOSOutputFormat } from "expo-audio";

const IS_ANDROID = Platform.OS === "android";

const RECORDING_OPTIONS = IS_ANDROID
  ? {
      extension: ".aac",
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 64000,
      android: {
        outputFormat: "aac_adts" as const,
        audioEncoder: "aac" as const,
      },
    }
  : {
      extension: ".wav",
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 256000,
      ios: {
        outputFormat: IOSOutputFormat.LINEARPCM,
        audioQuality: AudioQuality.MAX,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: { mimeType: "audio/wav" },
    };

const HEADER_BYTES = IS_ANDROID ? 0 : 44;

export const AUDIO_MIME_TYPE = IS_ANDROID ? "audio/aac" : "audio/pcm;rate=16000";

export function useAudioCapture(onChunk: (base64: string, mimeType: string) => void) {
  // Track live recording state via the status listener — avoids stale closures
  // and doesn't cause re-renders (ref, not state).
  const isRecordingRef = useRef(false);

  const recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    isRecordingRef.current = status.isRecording ?? false;
  });

  // Keep a ref for cleanup so it works with [] deps without a stale closure.
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const recorderStartedRef = useRef(false); // true once we have called record()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturingRef = useRef(false);
  const turnOffsetRef = useRef(0);

  // Only runs on unmount — [] deps prevents mid-conversation cleanup.
  useEffect(() => {
    return () => {
      capturingRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // stop() is async; .catch() prevents unhandled-rejection noise.
      if (recorderStartedRef.current) {
        recorderStartedRef.current = false;
        recorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Brings the recorder to a fresh "recording" state. Resets the file offset
  // so the interval starts reading from the new recording's beginning.
  const activateRecorder = useCallback(async () => {
    await recorder.prepareToRecordAsync();
    recorder.record();
    recorderStartedRef.current = true;
    turnOffsetRef.current = HEADER_BYTES;
    console.log("[audio] recorder started, offset reset to", HEADER_BYTES);
  }, [recorder]);

  const start = useCallback(async () => {
    if (!recorderStartedRef.current) {
      // ── First PTT press ──
      await AudioModule.requestRecordingPermissionsAsync();
      await activateRecorder();

      intervalRef.current = setInterval(async () => {
        if (!capturingRef.current) return;
        const { uri } = recorder;
        if (!uri) return;
        try {
          const response = await fetch(uri);
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength <= turnOffsetRef.current) return;
          const slice = buffer.slice(turnOffsetRef.current);
          turnOffsetRef.current = buffer.byteLength;
          const bytes = new Uint8Array(slice);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          onChunk(btoa(binary), AUDIO_MIME_TYPE);
        } catch {
          // File not yet flushed to disk
        }
      }, 100);
    } else if (!isRecordingRef.current) {
      // ── Subsequent press but OS stopped the recorder (e.g. audio focus) ──
      console.log("[audio] recorder was stopped externally — re-preparing");
      await activateRecorder();
    } else {
      // ── Subsequent press, recorder still live — snap offset to now ──
      const { uri } = recorder;
      if (uri) {
        try {
          const res = await fetch(uri);
          const buf = await res.arrayBuffer();
          turnOffsetRef.current = buf.byteLength;
          console.log("[audio] offset snapped to", turnOffsetRef.current);
        } catch {
          console.warn("[audio] could not snap offset; keeping previous value");
        }
      } else {
        console.warn("[audio] recorder.uri is null on subsequent press");
      }
    }

    capturingRef.current = true;
  }, [recorder, activateRecorder, onChunk]);

  const stop = useCallback(async () => {
    capturingRef.current = false;
  }, []);

  return { start, stop };
}
