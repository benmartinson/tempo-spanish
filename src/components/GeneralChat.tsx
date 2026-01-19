import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// Backend WebSocket URL - connects to the Python FastAPI server
// For local development, use your machine's IP address (not localhost) when testing on a physical device
const BACKEND_WS_URL = 'ws://192.168.1.124:8000/ws/transcribe';

interface TranscriptWord {
  word: string;
  confidence: number;
}

interface BackendMessage {
  type: 'ready' | 'connected' | 'transcript' | 'metadata' | 'error';
  message?: string;
  transcript?: string;
  confidence?: number;
  is_final?: boolean;
  words?: TranscriptWord[];
}

const GeneralChat: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioChunksRef = useRef<string[]>([]);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Request microphone permission on mount
    requestPermission();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  const requestPermission = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status !== 'granted') {
        setError('Microphone permission is required for speech recognition');
      }
    } catch (err) {
      setError('Failed to request microphone permission');
      console.error('Permission error:', err);
    }
  };

  const cleanup = async () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (err) {
        // Recording may already be stopped
      }
      recordingRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const connectToBackend = (): Promise<WebSocket> => {
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
              break;
            
            case 'connected':
              console.log('DeepGram connected via backend');
              resolve(ws);
              break;
            
            case 'transcript':
              if (data.transcript) {
                if (data.is_final) {
                  // Final transcript - append to permanent transcript
                  setTranscript((prev) => prev + (prev ? ' ' : '') + data.transcript);
                  setInterimTranscript('');
                } else {
                  // Interim result - show as temporary
                  setInterimTranscript(data.transcript);
                }
              }
              break;
            
            case 'error':
              console.error('Backend error:', data.message);
              setError(data.message || 'Server error occurred');
              reject(new Error(data.message || 'Server error'));
              break;
            
            case 'metadata':
              console.log('Received metadata from DeepGram');
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

  const startRecording = async () => {
    if (!hasPermission) {
      setError('Microphone permission not granted');
      return;
    }

    setError(null);
    setIsConnecting(true);
    setTranscript('');
    setInterimTranscript('');

    try {
      // Connect to backend server first
      wsRef.current = await connectToBackend();

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording with PCM format
      const recording = new Audio.Recording();
      
      await recording.prepareToRecordAsync({
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

      recordingRef.current = recording;
      await recording.startAsync();
      setIsRecording(true);
      setIsConnecting(false);

      // Start streaming audio chunks to backend server
      startAudioStreaming();

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Please try again.');
      setIsConnecting(false);
      cleanup();
    }
  };

  const startAudioStreaming = () => {
    let lastBytesSent = 0;
    const headerSize = 44; // WAV header size
    // 80ms chunks at 16kHz, 16-bit mono = 2560 bytes (recommended by DeepGram)
    const chunkSize = 2560;

    // Poll for new audio data every 80ms to match chunk size
    streamIntervalRef.current = setInterval(async () => {
      if (!recordingRef.current || !wsRef.current) return;
      if (wsRef.current.readyState !== WebSocket.OPEN) return;

      try {
        const uri = recordingRef.current.getURI();
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
            wsRef.current.send(chunk.buffer);
            lastBytesSent += chunkSize;
          }
        }
      } catch (err) {
        // Ignore errors during streaming - file might be temporarily locked
        console.log('Streaming chunk skipped:', err);
      }
    }, 80);
  };

  const stopRecording = async () => {
    setIsRecording(false);

    // Stop the streaming interval first
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    // Stop recording
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (err) {
        console.error('Error stopping recording:', err);
      }
      recordingRef.current = null;
    }

    // Close WebSocket connection after a short delay to receive final transcripts
    setTimeout(() => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }, 1500);

    // Reset audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
  };

  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Voice Chat</Text>
        <Text style={styles.subtitle}>Tap the microphone to start speaking</Text>
      </View>

      <ScrollView style={styles.transcriptContainer} contentContainerStyle={styles.transcriptContent}>
        {transcript || interimTranscript ? (
          <Text style={styles.transcriptText}>
            {transcript}
            {interimTranscript && (
              <Text style={styles.interimText}> {interimTranscript}</Text>
            )}
          </Text>
        ) : (
          <Text style={styles.placeholderText}>
            Your speech will appear here...
          </Text>
        )}
      </ScrollView>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.controlsContainer}>
        {transcript && (
          <TouchableOpacity style={styles.clearButton} onPress={clearTranscript}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordingButton,
            isConnecting && styles.connectingButton,
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isConnecting || hasPermission === false}
        >
          {isConnecting ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <View style={[styles.micIcon, isRecording && styles.stopIcon]} />
          )}
        </TouchableOpacity>

        <Text style={styles.statusText}>
          {isConnecting
            ? 'Connecting...'
            : isRecording
            ? 'Listening...'
            : 'Tap to speak'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 5,
  },
  transcriptContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 20,
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
  },
  transcriptContent: {
    flexGrow: 1,
  },
  transcriptText: {
    fontSize: 18,
    color: '#fff',
    lineHeight: 28,
  },
  interimText: {
    color: '#888',
    fontStyle: 'italic',
  },
  placeholderText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 20,
  },
  errorContainer: {
    marginHorizontal: 20,
    padding: 12,
    backgroundColor: '#ff4757',
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
  },
  controlsContainer: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 20,
  },
  clearButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 20,
    marginBottom: 20,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4a69bd',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a69bd',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  recordingButton: {
    backgroundColor: '#ff4757',
    shadowColor: '#ff4757',
  },
  connectingButton: {
    backgroundColor: '#888',
    shadowColor: '#888',
  },
  micIcon: {
    width: 24,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  statusText: {
    marginTop: 15,
    color: '#888',
    fontSize: 14,
  },
});

export default GeneralChat;
