import * as FileSystem from "expo-file-system/legacy";
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  IOSOutputFormat,
  AudioQuality,
  type AudioPlayer,
  type AudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { decode, encode } from "base64-arraybuffer";
import {
  TranscriptCallbacks,
  BackendMessage,
  TranscriptionResponse,
  AccuracyResult,
} from "../types";
import { supabase } from "../../lib/supabase";
import Constants from "expo-constants";

// Backend URLs - all configured in app.config.js
const config = Constants.expoConfig?.extra;

export const BACKEND_BASE_URL = __DEV__
  ? // ? config?.productionBaseUrl
    config?.devBaseUrl
  : config?.productionBaseUrl;
export const BACKEND_WS_URL = __DEV__
  ? config?.devWsUrl
  : config?.productionWsUrl;

// Debug: uncomment to verify which URLs are being used
// console.log('Environment:', __DEV__ ? 'DEV' : 'PROD', 'Backend:', BACKEND_BASE_URL);

export const generateTTS = async (text: string): Promise<string> => {
  const resp = await fetch(`${BACKEND_BASE_URL}/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`TTS API error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.audio;
};

// Short sound effects for recording
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dingSource = require("../../assets/ding.wav");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dingStopSource = require("../../assets/ding-stop.wav");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const warningBeepSource = require("../../assets/warning-beep.wav");

const playSoundEffect = (
  source: number,
  options?: { volume?: number },
) => {
  const player = createAudioPlayer(source, { keepAudioSessionActive: true });
  if (options?.volume !== undefined) player.volume = options.volume;
  player.play();
  player.addListener("playbackStatusUpdate", (status) => {
    if (status.didJustFinish) {
      player.remove();
    }
  });
};

export const playDing = () => playSoundEffect(dingSource);
export const playDingStop = () => playSoundEffect(dingStopSource);
export const playDingWarning = () => playSoundEffect(warningBeepSource);

// Global reference to currently playing sound to prevent overlapping audio
let currentPlayingSound: AudioPlayer | null = null;

export const playAudio = async (audioBase64: string) => {
  try {
    // Stop any currently playing audio
    if (currentPlayingSound) {
      currentPlayingSound.pause();
      currentPlayingSound.remove();
      currentPlayingSound = null;
    }

    // Configure audio mode for playback through speakers
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    const sound = createAudioPlayer({
      uri: `data:audio/mp3;base64,${audioBase64}`,
    });

    currentPlayingSound = sound;

    sound.play();
    // Resolve when finished, and clean up
    return new Promise<void>((resolve) => {
      const subscription = sound.addListener(
        "playbackStatusUpdate",
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.remove();
            subscription.remove();
            if (currentPlayingSound === sound) {
              currentPlayingSound = null;
            }
            resolve();
          }
        },
      );
    });
  } catch (err) {
    console.error("Error playing audio:", err);
  }
};

export const playAudioSequence = async (clips: string[]) => {
  for (const clip of clips) {
    await playAudio(clip);
  }
};

export const playAiSpeech = async ({
  segmentText,
  videoId,
  sentenceIndex,
  supabase,
}: {
  segmentText: string;
  videoId?: number;
  sentenceIndex?: number;
  supabase?: any;
}) => {
  // Check cache first
  if (supabase && videoId != null && sentenceIndex != null) {
    const { data: cached } = await supabase
      .from("sentence_insights")
      .select("segment_recording")
      .eq("video_id", videoId)
      .eq("sentence_index", sentenceIndex)
      .maybeSingle();

    if (cached?.segment_recording) {
      await playAudio(cached.segment_recording);
      return;
    }
  }

  // Generate new TTS
  const base64 = await generateTTS(segmentText);
  await playAudio(base64);

  // Save to cache
  if (supabase && videoId != null && sentenceIndex != null) {
    await supabase.from("sentence_insights").upsert(
      {
        video_id: videoId,
        sentence_index: sentenceIndex,
        segment_recording: base64,
      },
      { onConflict: "video_id,sentence_index" },
    );
  }
};

// Function to stop all audio playback
export const stopAudio = async () => {
  if (currentPlayingSound) {
    try {
      currentPlayingSound.pause();
      currentPlayingSound.remove();
      currentPlayingSound = null;
    } catch (err) {
      console.error("Error stopping audio:", err);
    }
  }
};

/**
 * Play audio from Supabase storage bucket
 * @param storagePath - The path of the file in the shadow_recordings bucket
 */
export const playAudioFromStorage = async (
  storagePath: string,
): Promise<void> => {
  try {
    // Stop any currently playing audio
    if (currentPlayingSound) {
      currentPlayingSound.pause();
      currentPlayingSound.remove();
      currentPlayingSound = null;
    }

    // Get a signed URL for the audio file
    const { data, error } = await supabase.storage
      .from("shadow_recordings")
      .createSignedUrl(storagePath, 60); // URL valid for 60 seconds

    if (error || !data?.signedUrl) {
      throw new Error(
        `Failed to get audio URL: ${error?.message || "No URL returned"}`,
      );
    }

    // Configure audio mode for playback through speakers
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    const sound = createAudioPlayer({
      uri: data.signedUrl,
    });

    currentPlayingSound = sound;

    sound.play();
    // Unload sound when finished to free memory
    const subscription = sound.addListener("playbackStatusUpdate", (status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.remove();
        subscription.remove();
        if (currentPlayingSound === sound) {
          currentPlayingSound = null;
        }
      }
    });
  } catch (err) {
    console.error("Error playing audio from storage:", err);
    throw err;
  }
};

/**
 * Delete audio file from Supabase storage bucket
 * @param storagePath - The path of the file in the shadow_recordings bucket
 */
export const deleteAudioFromStorage = async (
  storagePath: string,
): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from("shadow_recordings")
      .remove([storagePath]);

    if (error) {
      console.error("Storage delete error:", error);
      throw new Error(`Failed to delete audio: ${error.message}`);
    }

    console.log(`Audio deleted successfully: ${storagePath}`);
  } catch (err) {
    console.error("Error deleting audio from storage:", err);
    throw err;
  }
};

/**
 * Connect to the backend WebSocket server for transcription
 */
export const connectToBackend = (
  callbacks: TranscriptCallbacks,
): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BACKEND_WS_URL);

    ws.onopen = () => {
      console.log("Connected to backend server");
    };

    ws.onmessage = (event) => {
      try {
        const data: BackendMessage = JSON.parse(event.data);

        switch (data.type) {
          case "ready":
            console.log("Server ready:", data.message);
            callbacks.onReady?.(data.message || "");
            break;

          case "connected":
            callbacks.onConnected?.();
            resolve(ws);
            break;

          case "transcript":
            if (data.transcript) {
              callbacks.onTranscript?.(
                data.transcript,
                data.is_final || false,
                data.words,
              );
            }
            break;

          case "error":
            console.error("Backend error:", data.message);
            callbacks.onError?.(data.message || "Server error occurred");
            reject(new Error(data.message || "Server error"));
            break;

          case "metadata":
            console.log("Received metadata from DeepGram");
            callbacks.onMetadata?.();
            break;
        }
      } catch (err) {
        console.error("Error parsing backend message:", err);
      }
    };

    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      reject(new Error("Failed to connect to transcription server"));
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
    };

    // Timeout if we don't get connected within 10 seconds
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Connection timeout"));
      }
    }, 10000);
  });
};

/**
 * Start streaming audio chunks to the backend server
 * Returns a function to stop the streaming
 */
export const startAudioStreaming = (
  getRecording: () => AudioRecorder | null,
  getWebSocket: () => WebSocket | null,
): NodeJS.Timeout => {
  let lastBytesSent = 0;
  const headerSize = 44; // WAV header size
  // 80ms chunks at 16kHz, 16-bit mono = 2560 bytes (recommended by DeepGram)
  const chunkSize = 2560;

  // Poll for new audio data every 80ms to match chunk size
  const intervalId = setInterval(async () => {
    const recording = getRecording();
    const ws = getWebSocket();

    if (!recording || !ws) return;
    if (ws.readyState !== WebSocket.OPEN) return;

    try {
      const uri = recording.uri;
      if (!uri) return;

      // Read the entire file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      // Convert base64 to binary
      const binaryString = atob(base64Audio);
      const totalBytes = binaryString.length;

      // Calculate how many audio bytes we have (excluding header)
      const audioDataLength = totalBytes - headerSize;

      // Only process if we have at least one new chunk worth of data
      if (audioDataLength >= lastBytesSent + chunkSize) {
        const bytes = new Uint8Array(totalBytes);
        for (let i = 0; i < totalBytes; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Send complete 80ms chunks
        while (lastBytesSent + chunkSize <= audioDataLength) {
          const startOffset = headerSize + lastBytesSent;
          const chunk = bytes.slice(startOffset, startOffset + chunkSize);
          ws.send(chunk.buffer);
          lastBytesSent += chunkSize;
        }
      }
    } catch (err) {
      // Ignore errors during streaming - file might be temporarily locked
      console.log("Streaming chunk skipped:", err);
    }
  }, 80);

  return intervalId;
};

/**
 * Get the audio recording configuration
 */
export const getRecordingConfig = (): RecordingOptions => ({
  isMeteringEnabled: true,
  extension: ".wav",
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 256000,
  android: {
    extension: ".mp3",
    outputFormat: "default",
    audioEncoder: "default",
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
});

/**
 * Request microphone permission
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
  const { granted } = await requestRecordingPermissionsAsync();
  return granted;
};

/**
 * Set audio mode for recording.
 */
export const setAudioModeForRecording = async (
  isRecording: boolean,
): Promise<void> => {
  if (isRecording) {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldRouteThroughEarpiece: false,
    });
    return;
  }

  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
    shouldPlayInBackground: false,
  });
};

/**
 * Response from batch transcription endpoint
 */

/**
 * Normalize a string for comparison - lowercase, remove accents and punctuation
 */

/**
 * Calculate Levenshtein distance between two strings
 */

/**
 * Trim silence/low-volume sections from WAV audio data
 * Keeps a short buffer between trimmed sections for natural sound
 * @param audioBase64 - Base64 encoded WAV audio
 * @param options - Configuration options for trimming
 * @returns Trimmed audio as base64 string
 */
export const trimSilenceFromAudio = (
  audioBase64: string,
  options: {
    /** RMS threshold below which audio is considered silence (0-1). Default: 0.01 */
    silenceThreshold?: number;
    /** Window size in samples for RMS calculation. Default: 1600 (100ms at 16kHz) */
    windowSize?: number;
    /** Buffer samples to keep before/after non-silent sections. Default: 800 (50ms at 16kHz) */
    bufferSamples?: number;
    /** Minimum silence duration in samples to trigger trimming. Default: 4800 (300ms at 16kHz) */
    minSilenceDuration?: number;
  } = {},
): string => {
  const {
    silenceThreshold = 0.01,
    windowSize = 1600, // 100ms at 16kHz
    bufferSamples = 800, // 50ms buffer
    minSilenceDuration = 4800, // 300ms minimum silence to trim
  } = options;

  // Decode base64 to binary using base64-arraybuffer (React Native compatible)
  const arrayBuffer = decode(audioBase64);
  const bytes = new Uint8Array(arrayBuffer);

  // WAV header is 44 bytes
  const headerSize = 44;
  if (bytes.length <= headerSize) {
    return audioBase64; // No audio data to trim
  }

  // Extract audio samples (16-bit signed PCM)
  const audioData = bytes.slice(headerSize);
  const sampleCount = Math.floor(audioData.length / 2);
  const samples = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    // Little-endian 16-bit signed
    samples[i] = audioData[i * 2] | (audioData[i * 2 + 1] << 8);
  }

  // Find non-silent regions using RMS (Root Mean Square) analysis
  const isLoud = new Array<boolean>(sampleCount).fill(false);

  for (let i = 0; i < sampleCount; i += windowSize) {
    const windowEnd = Math.min(i + windowSize, sampleCount);
    let sumSquares = 0;

    for (let j = i; j < windowEnd; j++) {
      const normalized = samples[j] / 32768; // Normalize to -1 to 1
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / (windowEnd - i));

    if (rms > silenceThreshold) {
      // Mark this window as loud
      for (let j = i; j < windowEnd; j++) {
        isLoud[j] = true;
      }
    }
  }

  // Find contiguous regions of silence and sound
  const regions: { start: number; end: number; isSilent: boolean }[] = [];
  let currentStart = 0;
  let currentIsSilent = !isLoud[0];

  for (let i = 1; i < sampleCount; i++) {
    const isSilent = !isLoud[i];
    if (isSilent !== currentIsSilent) {
      regions.push({ start: currentStart, end: i, isSilent: currentIsSilent });
      currentStart = i;
      currentIsSilent = isSilent;
    }
  }
  regions.push({
    start: currentStart,
    end: sampleCount,
    isSilent: currentIsSilent,
  });

  // Determine which samples to keep:
  // - Keep all non-silent regions
  // - Keep short silence regions (< minSilenceDuration)
  // - For long silence regions, only keep bufferSamples at start and end
  const keepSamples = new Array<boolean>(sampleCount).fill(false);

  for (const region of regions) {
    const duration = region.end - region.start;

    if (!region.isSilent) {
      // Keep all non-silent samples
      for (let i = region.start; i < region.end; i++) {
        keepSamples[i] = true;
      }
    } else if (duration < minSilenceDuration) {
      // Keep short silence regions entirely
      for (let i = region.start; i < region.end; i++) {
        keepSamples[i] = true;
      }
    } else {
      // For long silence, keep only buffer at start and end
      const bufferEnd = Math.min(region.start + bufferSamples, region.end);
      const bufferStart = Math.max(region.end - bufferSamples, region.start);

      for (let i = region.start; i < bufferEnd; i++) {
        keepSamples[i] = true;
      }
      for (let i = bufferStart; i < region.end; i++) {
        keepSamples[i] = true;
      }
    }
  }

  // Add buffer around transitions (expand non-silent regions)
  const expandedKeep = [...keepSamples];
  for (let i = 0; i < sampleCount; i++) {
    if (keepSamples[i]) {
      // Expand backwards
      for (let j = Math.max(0, i - bufferSamples); j < i; j++) {
        expandedKeep[j] = true;
      }
      // Expand forwards
      for (
        let j = i + 1;
        j < Math.min(sampleCount, i + bufferSamples + 1);
        j++
      ) {
        expandedKeep[j] = true;
      }
    }
  }

  // Collect samples to keep
  const keptSamples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    if (expandedKeep[i]) {
      keptSamples.push(samples[i]);
    }
  }

  // If we didn't trim anything significant, return original
  if (keptSamples.length >= sampleCount * 0.95) {
    return audioBase64;
  }

  // Build new WAV file
  const newAudioDataLength = keptSamples.length * 2;
  const newFileSize = headerSize + newAudioDataLength;
  const newBytes = new Uint8Array(newFileSize);

  // Copy original header
  newBytes.set(bytes.slice(0, headerSize));

  // Update header fields for new size
  // Bytes 4-7: File size - 8 (little-endian)
  const chunkSize = newFileSize - 8;
  newBytes[4] = chunkSize & 0xff;
  newBytes[5] = (chunkSize >> 8) & 0xff;
  newBytes[6] = (chunkSize >> 16) & 0xff;
  newBytes[7] = (chunkSize >> 24) & 0xff;

  // Bytes 40-43: Data chunk size (little-endian)
  newBytes[40] = newAudioDataLength & 0xff;
  newBytes[41] = (newAudioDataLength >> 8) & 0xff;
  newBytes[42] = (newAudioDataLength >> 16) & 0xff;
  newBytes[43] = (newAudioDataLength >> 24) & 0xff;

  // Write audio samples
  for (let i = 0; i < keptSamples.length; i++) {
    const sample = keptSamples[i];
    newBytes[headerSize + i * 2] = sample & 0xff;
    newBytes[headerSize + i * 2 + 1] = (sample >> 8) & 0xff;
  }

  // Convert back to base64 using base64-arraybuffer (React Native compatible)
  return encode(newBytes.buffer);
};

/**
 * Find the byte offset where the "data" chunk starts in a WAV file.
 * WAV headers can vary in size due to extra chunks (fact, LIST, etc).
 * Returns the offset of the first byte of PCM data (after the "data" + size fields).
 */
const findWavDataOffset = (bytes: Uint8Array): number => {
  // Search for "data" subchunk ID (0x64 0x61 0x74 0x61)
  for (let i = 12; i < bytes.length - 8; i++) {
    if (
      bytes[i] === 0x64 &&
      bytes[i + 1] === 0x61 &&
      bytes[i + 2] === 0x74 &&
      bytes[i + 3] === 0x61
    ) {
      // "data" found at i, data size at i+4..i+7, PCM starts at i+8
      return i + 8;
    }
  }
  return 44; // fallback to standard header size
};

export const concatenateWavFiles = async (uris: string[]): Promise<string> => {
  if (uris.length === 0) throw new Error("No audio files to concatenate");
  if (uris.length === 1) return uris[0];

  const pcmBuffers: Uint8Array[] = [];
  let firstFileBytes: Uint8Array | null = null;
  let firstDataOffset = 0;
  let totalPcmLength = 0;

  for (let i = 0; i < uris.length; i++) {
    const base64 = await FileSystem.readAsStringAsync(uris[i], {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);
    const bytes = new Uint8Array(arrayBuffer);
    const dataOffset = findWavDataOffset(bytes);

    if (i === 0) {
      firstFileBytes = bytes;
      firstDataOffset = dataOffset;
    }

    const pcm = bytes.slice(dataOffset);
    pcmBuffers.push(pcm);
    totalPcmLength += pcm.length;
  }

  // Build new WAV: header from first file (up to data chunk) + all PCM data
  const headerBytes = firstFileBytes!.slice(0, firstDataOffset);
  const newBytes = new Uint8Array(firstDataOffset + totalPcmLength);
  newBytes.set(headerBytes, 0);

  // Update RIFF chunk size (bytes 4-7): file size - 8
  const chunkSize = firstDataOffset + totalPcmLength - 8;
  newBytes[4] = chunkSize & 0xff;
  newBytes[5] = (chunkSize >> 8) & 0xff;
  newBytes[6] = (chunkSize >> 16) & 0xff;
  newBytes[7] = (chunkSize >> 24) & 0xff;

  // Update data chunk size (4 bytes before PCM data starts)
  const dataSizeOffset = firstDataOffset - 4;
  newBytes[dataSizeOffset] = totalPcmLength & 0xff;
  newBytes[dataSizeOffset + 1] = (totalPcmLength >> 8) & 0xff;
  newBytes[dataSizeOffset + 2] = (totalPcmLength >> 16) & 0xff;
  newBytes[dataSizeOffset + 3] = (totalPcmLength >> 24) & 0xff;

  // Write PCM data
  let offset = firstDataOffset;
  for (const pcm of pcmBuffers) {
    newBytes.set(pcm, offset);
    offset += pcm.length;
  }

  const resultBase64 = encode(newBytes.buffer);
  const outputUri = `${FileSystem.cacheDirectory}phrase_concat_${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(outputUri, resultBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outputUri;
};

/**
 * Upload audio file to Supabase storage bucket
 * @param audioUri - Local URI of the audio file
 * @param userId - User ID for organizing files
 * @param videoId - Video ID for the recording
 * @param sentenceIndex - Sentence index for the recording
 * @returns The storage path of the uploaded file
 */
export const uploadAudioToStorage = async (
  audioUri: string,
  userId: string,
  videoId: string,
  sentenceIndex: number,
): Promise<string> => {
  try {
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: "base64",
    });

    const filename = `${userId}/${videoId}_${sentenceIndex}.wav`;

    const { data, error } = await supabase.storage
      .from("shadow_recordings")
      .upload(filename, decode(base64Audio), {
        contentType: "audio/wav",
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error);
      throw new Error(`Failed to upload audio: ${error.message}`);
    }

    console.log(`Audio uploaded successfully: ${data.path}`);
    return data.path;
  } catch (err) {
    console.error("Error uploading audio to storage:", err);
    throw err;
  }
};

/**
 * Send audio file to backend for batch transcription
 */
export const sendAudioForTranscription = async (
  audioUri: string,
  targetLanguage: string = "es",
): Promise<TranscriptionResponse> => {
  try {
    // Read the audio file as base64
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: "base64",
    });

    // Create form data for the request
    const formData = new FormData();
    formData.append("file", {
      uri: audioUri,
      type: "audio/wav",
      name: "recording.wav",
    } as any);

    console.log(`Sending audio for transcription: ${audioUri}`);

    const response = await fetch(
      `${BACKEND_BASE_URL}/api/transcribe?language=${targetLanguage}`,
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Transcription failed: ${response.status} - ${errorText}`,
      );
    }

    const result: TranscriptionResponse = await response.json();
    return result;
  } catch (err) {
    console.error("Error sending audio for transcription:", err);
    throw err;
  }
};
