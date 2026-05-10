import { useRef, useCallback, useEffect } from "react";
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
  const recorderActiveRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturingRef = useRef(false);
  // Byte offset at the start of the current PTT turn — only audio after this
  // point is sent, so previous turns don't get re-transmitted.
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
      // First PTT press: start the recorder and the polling interval once.
      await AudioModule.requestRecordingPermissionsAsync();
      await recorder.prepareToRecordAsync();
      recorder.record();
      recorderActiveRef.current = true;
      turnOffsetRef.current = 0; // first interval tick will skip WAV header

      intervalRef.current = setInterval(async () => {
        if (!capturingRef.current) return;
        const uri = recorder.uri;
        if (!uri) return;
        try {
          const response = await fetch(uri);
          const buffer = await response.arrayBuffer();
          const startAt = turnOffsetRef.current === 0 ? WAV_HEADER_BYTES : turnOffsetRef.current;
          if (buffer.byteLength <= startAt) return;
          const slice = buffer.slice(startAt);
          turnOffsetRef.current = buffer.byteLength;
          const bytes = new Uint8Array(slice);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          onChunk(btoa(binary));
        } catch {
          // File may not be accessible yet
        }
      }, 100);
    } else {
      // Subsequent PTT presses: snap the current file size as the new turn
      // start so we never re-send audio from previous turns.
      const uri = recorder.uri;
      if (uri) {
        try {
          const res = await fetch(uri);
          const buf = await res.arrayBuffer();
          turnOffsetRef.current = buf.byteLength;
        } catch {
          // keep existing offset — next interval tick will catch up
        }
      }
    }

    capturingRef.current = true;
  }, [recorder, onChunk]);

  const stop = useCallback(async () => {
    capturingRef.current = false;
    // Recorder stays running between turns — calling stop() on Android
    // releases the native object and makes it unre-usable for future turns.
  }, []);

  return { start, stop };
}
