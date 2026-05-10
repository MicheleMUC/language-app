import { useRef, useCallback } from "react";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";

export function useAudioCapture(onChunk: (base64: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    await AudioModule.requestRecordingPermissionsAsync();
    await recorder.prepareToRecordAsync();
    recorder.record();

    intervalRef.current = setInterval(async () => {
      const uri = recorder.uri;
      if (!uri) return;
      try {
        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        onChunk(btoa(binary));
      } catch {
        // recording may not yet have data
      }
    }, 250);
  }, [recorder, onChunk]);

  const stop = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    await recorder.stop();
  }, [recorder]);

  return { start, stop };
}
