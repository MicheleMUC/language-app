import { useRef, useCallback } from "react";
import { useAudioRecorder, AudioModule } from "expo-audio";

// PCM16 @ 16 kHz mono — what Gemini Live API expects.
// iOS records linear PCM natively; Android writes an m4a container whose
// raw bytes we ship incrementally (server side would need a real transcoder
// for a production build, but this gets the pipe working end-to-end).
const PCM_OPTIONS = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  linearPCMBitDepth: 16 as const,
  linearPCMIsBigEndian: false,
  linearPCMIsFloat: false,
};

const WAV_HEADER_BYTES = 44; // standard WAV header size

export function useAudioCapture(onChunk: (base64: string) => void) {
  const recorder = useAudioRecorder(PCM_OPTIONS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const byteOffsetRef = useRef(0);

  const start = useCallback(async () => {
    await AudioModule.requestRecordingPermissionsAsync();
    byteOffsetRef.current = 0;
    await recorder.prepareToRecordAsync();
    recorder.record();

    intervalRef.current = setInterval(async () => {
      const uri = recorder.uri;
      if (!uri) return;
      try {
        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();
        // Skip WAV header on first read; only send bytes we haven't sent yet.
        const startAt = byteOffsetRef.current === 0
          ? WAV_HEADER_BYTES
          : byteOffsetRef.current;
        if (buffer.byteLength <= startAt) return;
        const newSlice = buffer.slice(startAt);
        byteOffsetRef.current = buffer.byteLength;
        const bytes = new Uint8Array(newSlice);
        let binary = "";
        // btoa via charCodeAt is faster for small typed arrays
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        onChunk(btoa(binary));
      } catch {
        // recording may not yet have data
      }
    }, 100); // 100 ms chunks (~1600 samples @ 16 kHz) for low latency
  }, [recorder, onChunk]);

  const stop = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    byteOffsetRef.current = 0;
    await recorder.stop();
  }, [recorder]);

  return { start, stop };
}
