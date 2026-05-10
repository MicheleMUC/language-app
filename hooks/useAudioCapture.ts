import { useRef, useCallback } from "react";
import { useAudioRecorder, AudioModule, AudioQuality, IOSOutputFormat } from "expo-audio";

const PCM_OPTIONS = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: {
    outputFormat: "mpeg4" as const,
    audioEncoder: "aac" as const,
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/wav",
  },
};

const WAV_HEADER_BYTES = 44;

export function useAudioCapture(onChunk: (base64: string) => void) {
  const recorder = useAudioRecorder(PCM_OPTIONS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const byteOffsetRef = useRef(0);
  const isRecordingRef = useRef(false); // guard against stop-before-start

  const start = useCallback(async () => {
    await AudioModule.requestRecordingPermissionsAsync();
    byteOffsetRef.current = 0;
    await recorder.prepareToRecordAsync();
    recorder.record();
    isRecordingRef.current = true;

    intervalRef.current = setInterval(async () => {
      const uri = recorder.uri;
      if (!uri) return;
      try {
        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();
        const startAt = byteOffsetRef.current === 0 ? WAV_HEADER_BYTES : byteOffsetRef.current;
        if (buffer.byteLength <= startAt) return;
        const newSlice = buffer.slice(startAt);
        byteOffsetRef.current = buffer.byteLength;
        const bytes = new Uint8Array(newSlice);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        onChunk(btoa(binary));
      } catch {
        // recording may not yet have data
      }
    }, 100);
  }, [recorder, onChunk]);

  const stop = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    byteOffsetRef.current = 0;
    if (!isRecordingRef.current) return; // never started — skip stop()
    isRecordingRef.current = false;
    try {
      await recorder.stop();
    } catch {
      // Android throws if recording duration was too short; safe to ignore
    }
  }, [recorder]);

  return { start, stop };
}
