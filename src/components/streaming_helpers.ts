import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import Constants from "expo-constants";
import {
  TranscriptCallbacks,
  BackendMessage,
  TranscriptionResponse,
  AccuracyResult,
} from "../types";

// Backend URLs - all configured in app.config.js
const config = Constants.expoConfig?.extra;

export const BACKEND_BASE_URL = __DEV__
  ? config?.devBaseUrl
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
    extension: ".wav",
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: ".wav",
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
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
 * Set audio mode for recording
 */
export const setAudioModeForRecording = async (
  isRecording: boolean,
): Promise<void> => {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: isRecording,
    playsInSilentModeIOS: isRecording,
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
  targetWords: { word: string; translation: string }[],
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
  for (const word of targetWords) {
    const { word: targetWord, translation: targetTranslation } = word;
    const normalizedTarget = normalize(targetWord);
    const normalizedTranslation = normalize(targetTranslation);
    if (!normalizedTarget) {
      // Skip empty words (punctuation only)
      continue;
    }

    // // Check if its translation equals the word itself
    if (normalizedTarget === normalizedTranslation) {
      matchedCount++;
      details.push({
        targetWord,
        matched: true,
      });
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
