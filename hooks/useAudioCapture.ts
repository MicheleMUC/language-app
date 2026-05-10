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

// iOS WAV files start with a 44-byte header; Android AAC-ADTS has no header.
const HEADER_BYTES = IS_ANDROID ? 0 : 44;

export const AUDIO_MIME_TYPE = IS_ANDROID ? "audio/aac" : "audio/pcm;rate=16000";

export function useAudioCapture(onChunk: (base64: string, mimeType: string) => void) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  // Keep a ref so the unmount cleanup can access it without being a dep.
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const recorderActiveRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturingRef = useRef(false);
  const turnOffsetRef = useRef(0);

  // [] deps: only runs on unmount — never mid-conversation.
  // stop() is async; use .catch() so the promise rejection doesn't leak.
  useEffect(() => {
    return () => {
      capturingRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (recorderActiveRef.current) {
        recorderActiveRef.current = false;
        recorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (!recorderActiveRef.current) {
      // First press: start the recorder and keep it running for the whole
      // conversation. We never call stop() between turns; only capturingRef
      // gates whether chunks are forwarded.
      await AudioModule.requestRecordingPermissionsAsync();
      await recorder.prepareToRecordAsync();
      recorder.record();
      recorderActiveRef.current = true;
      turnOffsetRef.current = HEADER_BYTES; // skip WAV header on first turn

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
          // File may not be flushed to disk yet
        }
      }, 100);
    } else {
      // Subsequent presses: snap the current file position so we only send
      // audio recorded after the user presses PTT again.
      const { uri } = recorder;
      if (uri) {
        try {
          const res = await fetch(uri);
          const buf = await res.arrayBuffer();
          turnOffsetRef.current = buf.byteLength;
        } catch { /* keep existing offset */ }
      }
    }

    capturingRef.current = true;
  }, [recorder, onChunk]);

  const stop = useCallback(async () => {
    // Stop forwarding chunks; recorder keeps running so the native object
    // stays alive and the next PTT press can reuse it without re-preparing.
    capturingRef.current = false;
  }, []);

  return { start, stop };
}
