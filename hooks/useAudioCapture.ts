import { useRef, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { useAudioRecorder, AudioModule, AudioQuality, IOSOutputFormat } from "expo-audio";

// iOS: true Linear PCM written as a growing WAV file — we skip the 44-byte
// header and stream raw PCM16 samples to the server.
// Android: AAC-ADTS bytestream — no container header, starts at byte 0.
// The server labels each chunk with the correct MIME type.
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
  const recorderActiveRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturingRef = useRef(false);
  const turnOffsetRef = useRef(0);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (recorderActiveRef.current) {
        recorderActiveRef.current = false;
        try { recorder.stop(); } catch { /* ignore */ }
      }
    };
  }, [recorder]);

  const start = useCallback(async () => {
    if (!recorderActiveRef.current) {
      await AudioModule.requestRecordingPermissionsAsync();
      await recorder.prepareToRecordAsync();
      recorder.record();
      recorderActiveRef.current = true;
      turnOffsetRef.current = 0;

      intervalRef.current = setInterval(async () => {
        if (!capturingRef.current) return;
        const uri = recorder.uri;
        if (!uri) return;
        try {
          const response = await fetch(uri);
          const buffer = await response.arrayBuffer();
          const startAt = turnOffsetRef.current === 0 ? HEADER_BYTES : turnOffsetRef.current;
          if (buffer.byteLength <= startAt) return;
          const slice = buffer.slice(startAt);
          turnOffsetRef.current = buffer.byteLength;
          const bytes = new Uint8Array(slice);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          onChunk(btoa(binary), AUDIO_MIME_TYPE);
        } catch {
          // File may not be accessible yet
        }
      }, 100);
    } else {
      const uri = recorder.uri;
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
    capturingRef.current = false;
  }, []);

  return { start, stop };
}
