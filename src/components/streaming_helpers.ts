import * as FileSystem from "expo-file-system/legacy";
import { Audio, InterruptionModeIOS } from "expo-av";
import Constants from "expo-constants";
import { decode, encode } from "base64-arraybuffer";
import {
  TranscriptCallbacks,
  BackendMessage,
  TranscriptionResponse,
  AccuracyResult,
} from "../types";
import { supabase } from "../../lib/supabase";

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

// Global reference to currently playing sound to prevent overlapping audio
let currentPlayingSound: Audio.Sound | null = null;

export const playAudio = async (audioBase64: string) => {
  try {
    // Stop any currently playing audio
    if (currentPlayingSound) {
      await currentPlayingSound.stopAsync();
      await currentPlayingSound.unloadAsync();
      currentPlayingSound = null;
    }

    // Configure audio mode for playback through speakers
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    const { sound } = await Audio.Sound.createAsync({
      uri: `data:audio/mp3;base64,${audioBase64}`,
    });

    currentPlayingSound = sound;

    await sound.playAsync();
    // Unload sound when finished to free memory
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        if (currentPlayingSound === sound) {
          currentPlayingSound = null;
        }
      }
    });
  } catch (err) {
    console.error("Error playing audio:", err);
  }
};

// Function to stop all audio playback
export const stopAudio = async () => {
  if (currentPlayingSound) {
    try {
      await currentPlayingSound.stopAsync();
      await currentPlayingSound.unloadAsync();
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
      await currentPlayingSound.stopAsync();
      await currentPlayingSound.unloadAsync();
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
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    const { sound } = await Audio.Sound.createAsync({
      uri: data.signedUrl,
    });

    currentPlayingSound = sound;

    await sound.playAsync();
    // Unload sound when finished to free memory
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
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
  getRecording: () => Audio.Recording | null,
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
      const uri = recording.getURI();
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
export const getRecordingConfig = (): Audio.RecordingOptions => ({
  android: {
    extension: ".mp3",
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: ".wav",
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 256000,
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
  const { status } = await Audio.requestPermissionsAsync();
  return status === "granted";
};

/**
 * Set audio mode for recording.
 *
 * NOTE: This relies on a native patch to expo-av (see patches/expo-av+16.0.8.patch).
 * Without the patch, setting allowsRecordingIOS back to false after recording has no
 * effect because expo-av skips the AVAudioSession category update when its internal
 * mode is Inactive — leaving the session stuck in PlayAndRecord and garbling WebView audio.
 */
export const setAudioModeForRecording = async (
  isRecording: boolean,
): Promise<void> => {
  if (isRecording) {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    });
    return;
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    staysActiveInBackground: false,
  });
};

/**
 * Response from batch transcription endpoint
 */

/**
 * Normalize a string for comparison - lowercase, remove accents and punctuation
 */
export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\w\s]/g, "") // punctuation
    .trim();

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [
    i,
  ]);

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0-1)
 */
function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Check if two words are similar enough to be considered a match
 */
function wordMatches(spoken: string, target: string, threshold = 0.7): boolean {
  const normalizedSpoken = normalize(spoken);
  const normalizedTarget = normalize(target);

  // Exact match
  if (normalizedSpoken === normalizedTarget) return true;

  // Partial match (one contains the other)
  if (
    normalizedSpoken.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedSpoken)
  ) {
    return true;
  }

  // Fuzzy match using similarity
  return similarity(normalizedSpoken, normalizedTarget) >= threshold;
}

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
    // Read the audio file as base64
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: "base64",
    });

    // Trim silence/low-volume sections from the audio before uploading
    // Set to false to disable trimming for debugging
    const enableTrimming = true;
    let audioToUpload = base64Audio;
    if (enableTrimming) {
      try {
        audioToUpload = trimSilenceFromAudio(base64Audio);
        console.log(
          `Audio trimmed: ${base64Audio.length} -> ${audioToUpload.length} chars`,
        );
      } catch (trimError) {
        console.warn("Failed to trim audio, using original:", trimError);
        // Fall back to original audio if trimming fails
      }
    }

    // Use a consistent filename based on user/video/sentence for upsert to work
    const filename = `${userId}/${videoId}_${sentenceIndex}.wav`;

    // Upload to Supabase storage with upsert to replace existing recording
    const { data, error } = await supabase.storage
      .from("shadow_recordings")
      .upload(filename, decode(audioToUpload), {
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

    const response = await fetch(`${BACKEND_BASE_URL}/api/transcribe`, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

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

/**
 * Calculate accuracy by comparing spoken words against target words
 * Uses a greedy matching approach that finds the best match for each target word
 */
export const calculateAccuracy = (
  spokenWords: string[],
  targetWords: string[],
) => {
  if (targetWords.length === 0) {
    return {
      percentage: 100,
      matchedWords: 0,
      totalWords: 0,
      details: [],
    };
  }

  const normalizedSpoken = spokenWords.map(normalize).filter(Boolean);
  const details: AccuracyResult["details"] = [];
  let matchedCount = 0;

  // Track which spoken words have been used
  const usedSpokenIndices = new Set<number>();

  // For each target word, try to find the best matching spoken word
  for (const targetWord of targetWords) {
    const normalizedTarget = normalize(targetWord);
    if (!normalizedTarget) {
      // Skip empty words (punctuation only)
      console.log("Skipping empty word:", targetWord);
      continue;
    }

    let bestMatchIndex = -1;
    let bestMatchScore = 0;

    // Find the best unused spoken word that matches this target
    for (let i = 0; i < normalizedSpoken.length; i++) {
      if (usedSpokenIndices.has(i)) continue;

      const spokenWord = normalizedSpoken[i];
      const score = similarity(spokenWord, normalizedTarget);

      if (score > bestMatchScore && score >= 0.6) {
        bestMatchScore = score;
        bestMatchIndex = i;
      }
    }

    if (bestMatchIndex !== -1) {
      // Found a match
      usedSpokenIndices.add(bestMatchIndex);
      matchedCount++;
      details.push({
        targetWord,
        matched: true,
        spokenWord: spokenWords[bestMatchIndex],
      });
    } else {
      // No match found
      details.push({
        targetWord,
        matched: false,
      });
    }
  }

  const totalWords = details.length;
  const percentage =
    totalWords > 0 ? Math.round((matchedCount / totalWords) * 100) : 0;

  return {
    percentage,
    matchedWords: matchedCount,
    totalWords,
    details,
  };
};

/**
 * Lenient word matching - returns true if words share at least 25% of characters.
 * This is forgiving to encourage users even with imperfect pronunciation.
 *
 * Example: "intelligente" (12 chars) vs "elegante" (8 chars)
 * - Shared: e, l, e, g, a, n, t, e = 8 characters
 * - Threshold: ceil(12 * 0.25) = 3
 * - 8 >= 3, so it matches
 */
// function levenshtein(a: string, b: string): number {
//   const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);

//   for (let j = 0; j <= a.length; j++) {
//     matrix[0][j] = j;
//   }

//   for (let i = 1; i <= b.length; i++) {
//     for (let j = 1; j <= a.length; j++) {
//       if (b[i - 1] === a[j - 1]) {
//         matrix[i][j] = matrix[i - 1][j - 1];
//       } else {
//         matrix[i][j] = Math.min(
//           matrix[i - 1][j] + 1,
//           matrix[i][j - 1] + 1,
//           matrix[i - 1][j - 1] + 1,
//         );
//       }
//     }
//   }

//   return matrix[b.length][a.length];
// }

// function similarity(a: string, b: string): number {
//   const distance = levenshtein(a, b);
//   return 1 - distance / Math.max(a.length, b.length);
// }
// function tokenSimilar(a: string, b: string): boolean {
//   if (a === b) return true;
//   if (a.length < 3 || b.length < 3) return false;

//   // allow partial overlap
//   if (a.includes(b) || b.includes(a)) return true;

//   return similarity(a, b) >= 0.6;
// }

// export const normalize = (s: string) =>
//   s
//     .toLowerCase()
//     .normalize("NFD")
//     .replace(/[\u0300-\u036f]/g, "") // strip accents
//     .replace(/[^\w\s]/g, "") // punctuation
//     .trim();

// export const joinWords = (words: string[]) => normalize(words.join(" "));

// export function softMatch(
//   spokenRaw: string,
//   targetRaw: string,
//   threshold = 0.6,
// ): boolean {
//   const spoken = normalize(spokenRaw);
//   const target = normalize(targetRaw);

//   if (!spoken || !target) return false;

//   // 1️⃣ quick win: prefix match (great for streaming)
//   if (target.startsWith(spoken) || spoken.startsWith(target)) {
//     return true;
//   }

//   // 2️⃣ token overlap score
//   const spokenTokens = spoken.split(" ");
//   const targetTokens = target.split(" ");

//   const overlapCount = spokenTokens.filter((st) =>
//     targetTokens.some((tt) => tokenSimilar(st, tt)),
//   ).length;

//   const tokenScore = overlapCount / targetTokens.length;

//   // 3️⃣ character similarity (edit distance)
//   const charScore = similarity(spoken, target);

//   // Weighted blend
//   const score = tokenScore * 0.6 + charScore * 0.4;

//   return score >= threshold;
// }

// const RESTART_WORDS = new Set([
//   "el",
//   "la",
//   "los",
//   "las",
//   "un",
//   "una",
//   "de",
//   "del",
//   "al",
// ]);

// export function collapseChurn(words: string[]): string[] {
//   const result: string[] = [];

//   for (const raw of words) {
//     const word = normalize(raw);
//     const last = result[result.length - 1];

//     // 🔁 Detect phrase restart
//     if (
//       RESTART_WORDS.has(word) &&
//       result.length >= 2 &&
//       result.includes(word)
//     ) {
//       // reset phrase
//       result.length = 0;
//       result.push(word);
//       continue;
//     }

//     if (!last) {
//       result.push(word);
//       continue;
//     }

//     // refinement of previous token
//     if (similarity(word, last) > 0.7) {
//       result[result.length - 1] = word;
//       continue;
//     }

//     result.push(word);
//   }

//   return result;
// }
