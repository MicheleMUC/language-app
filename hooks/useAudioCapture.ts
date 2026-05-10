import { useRef, useCallback } from "react";
import { Audio } from "expo-av";

// Captures mic audio as base64 PCM16 chunks via expo-av.
// On each chunk, calls onChunk with base64-encoded data.
export function useAudioCapture(onChunk: (base64: string) => void) {
  const recordingRef = useRef<Audio.Recording | null>(null);

  const start = useCallback(async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const { recording } = await Audio.Recording.createAsync(
      {
        isMeteringEnabled: false,
        android: {
          extension: ".raw",
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: ".caf",
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      },
      (status) => {
        // Status updates — metering disabled, no action needed here
      },
      100 // status update every 100ms
    );

    recordingRef.current = recording;

    // Poll the recording URI every 250ms and ship chunks to the relay
    const interval = setInterval(async () => {
      if (!recordingRef.current) {
        clearInterval(interval);
        return;
      }
      try {
        const uri = recordingRef.current.getURI();
        if (!uri) return;
        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        onChunk(btoa(binary));
      } catch {
        // recording may not yet have data; ignore
      }
    }, 250);

    return () => clearInterval(interval);
  }, [onChunk]);

  const stop = useCallback(async () => {
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  }, []);

  return { start, stop };
}
