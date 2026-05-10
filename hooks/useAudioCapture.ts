import { useRef, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { AudioRecorder, AudioModule, AudioQuality, IOSOutputFormat } from "expo-audio";

const IS_ANDROID = Platform.OS === "android";

const ANDROID_OPTIONS = {
  extension: ".aac",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    outputFormat: "aac_adts" as const,
    audioEncoder: "aac" as const,
  },
};

const IOS_OPTIONS = {
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
  const recorderRef = useRef<AudioRecorder | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturingRef = useRef(false);

  useEffect(() => {
    return () => {
      capturingRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (rec) {
        // stop() is async — use .catch() so the unhandled-rejection doesn't surface
        rec.stop().catch(() => {});
      }
    };
  }, []);

  const start = useCallback(async () => {
    // Tear down any previous recording before starting a fresh one
    capturingRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (recorderRef.current) {
      const old = recorderRef.current;
      recorderRef.current = null;
      try { await old.stop(); } catch { /* already stopped or released */ }
    }

    await AudioModule.requestRecordingPermissionsAsync();

    // Fresh AudioRecorder instance per PTT press — avoids the Android
    // "shared object already released" error that appears when reusing a
    // stopped native recorder.
    const recorder = new AudioRecorder(IS_ANDROID ? ANDROID_OPTIONS : IOS_OPTIONS);
    recorderRef.current = recorder;

    await recorder.prepareToRecordAsync();
    recorder.record();
    capturingRef.current = true;

    // `offset` is local to this recording session; each new turn starts at 0.
    let offset = HEADER_BYTES;

    intervalRef.current = setInterval(async () => {
      if (!capturingRef.current) return;
      const { uri } = recorder; // closed over this specific recorder
      if (!uri) return;
      try {
        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength <= offset) return;
        const slice = buffer.slice(offset);
        offset = buffer.byteLength;
        const bytes = new Uint8Array(slice);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        onChunk(btoa(binary), AUDIO_MIME_TYPE);
      } catch {
        // File may not be flushed to disk yet
      }
    }, 100);
  }, [onChunk]);

  const stop = useCallback(async () => {
    capturingRef.current = false;
    // Recorder keeps running so the file stays open; we simply stop sending
    // chunks until the next PTT press creates a fresh recorder.
  }, []);

  return { start, stop };
}
