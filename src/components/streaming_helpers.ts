import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';

// Backend URLs - connects to the Python FastAPI server
// For local development, use your machine's IP address (not localhost) when testing on a physical device
export const BACKEND_BASE_URL = 'http://192.168.1.124:8000';
export const BACKEND_WS_URL = 'ws://192.168.1.124:8000/ws/transcribe';

export interface TranscriptWord {
  word: string;
  confidence: number;
}

export interface BackendMessage {
  type: 'ready' | 'connected' | 'transcript' | 'metadata' | 'error';
  message?: string;
  transcript?: string;
  confidence?: number;
  is_final?: boolean;
  words?: TranscriptWord[];
}

export interface TranscriptCallbacks {
  onReady?: (message: string) => void;
  onConnected?: () => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onMetadata?: () => void;
}

/**
 * Connect to the backend WebSocket server for transcription
 */
export const connectToBackend = (callbacks: TranscriptCallbacks): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BACKEND_WS_URL);

    ws.onopen = () => {
      console.log('Connected to backend server');
    };

    ws.onmessage = (event) => {
      try {
        const data: BackendMessage = JSON.parse(event.data);

        switch (data.type) {
          case 'ready':
            console.log('Server ready:', data.message);
            callbacks.onReady?.(data.message || '');
            break;

          case 'connected':
            console.log('DeepGram connected via backend');
            callbacks.onConnected?.();
            resolve(ws);
            break;

          case 'transcript':
            if (data.transcript) {
              callbacks.onTranscript?.(data.transcript, data.is_final || false);
            }
            break;

          case 'error':
            console.error('Backend error:', data.message);
            callbacks.onError?.(data.message || 'Server error occurred');
            reject(new Error(data.message || 'Server error'));
            break;

          case 'metadata':
            console.log('Received metadata from DeepGram');
            callbacks.onMetadata?.();
            break;
        }
      } catch (err) {
        console.error('Error parsing backend message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      reject(new Error('Failed to connect to transcription server'));
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
    };

    // Timeout if we don't get connected within 10 seconds
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Connection timeout'));
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
  getWebSocket: () => WebSocket | null
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
        encoding: 'base64',
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
      console.log('Streaming chunk skipped:', err);
    }
  }, 80);

  return intervalId;
};

/**
 * Get the audio recording configuration
 */
export const getRecordingConfig = (): Audio.RecordingOptions => ({
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
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
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
});

/**
 * Request microphone permission
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
};

/**
 * Set audio mode for recording
 */
export const setAudioModeForRecording = async (isRecording: boolean): Promise<void> => {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: isRecording,
    playsInSilentModeIOS: isRecording,
  });
};
