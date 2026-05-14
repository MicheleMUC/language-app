import { useRef, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { useAudioRecorder, AudioModule, AudioQuality, IOSOutputFormat } from "expo-audio";
import type { RecordingOptions } from "expo-audio";
import type { CapturedAudio } from "@/types";

const IS_ANDROID = Platform.OS === "android";

const RECORDING_OPTIONS: RecordingOptions = {
  extension: IS_ANDROID ? ".aac" : ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: IS_ANDROID ? 64000 : 256000,
  android: {
    outputFormat: "aac_adts",
    audioEncoder: "aac",
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: "audio/wav" },
};

const AUDIO_MIME_TYPE = IS_ANDROID ? "audio/aac" : "audio/wav";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function useAudioCapture() {
  const isRecordingRef = useRef(false);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        recorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const start = useCallback(async () => {
    await AudioModule.requestRecordingPermissionsAsync();
    await recorder.prepareToRecordAsync();
    recorder.record();
    isRecordingRef.current = true;
    console.log("[audio] recorder started");
  }, [recorder]);

  const stop = useCallback(async (): Promise<CapturedAudio | null> => {
    if (!isRecordingRef.current) return null;

    const uri = recorder.uri;
    await recorder.stop();
    isRecordingRef.current = false;

    if (!uri) {
      console.warn("[audio] recorder.uri was empty on stop");
      return null;
    }

    try {
      const response = await fetch(uri);
      const buffer = await response.arrayBuffer();

      if (buffer.byteLength === 0) {
        console.warn("[audio] finalized recording was empty");
        return null;
      }

      console.log(`[audio] finalized recording: ${buffer.byteLength} bytes (${AUDIO_MIME_TYPE})`);
      return { data: arrayBufferToBase64(buffer), mimeType: AUDIO_MIME_TYPE };
    } catch (e) {
      console.warn("[audio] failed to read finalized recording", e);
      return null;
    }
  }, [recorder]);

  return { start, stop };
}
