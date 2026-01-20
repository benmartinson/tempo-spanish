import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { BACKEND_BASE_URL } from './streaming_helpers';
import { ChatMessage } from './ChatBubble';

const SUGGESTION_DELAY_MS = 2000;

interface SuggestionBoxProps {
  transcript: string;
  interimTranscript: string;
  messages: ChatMessage[];
  isRecording: boolean;
}

export interface SuggestionBoxRef {
  stop: () => void;
}

/**
 * Component that displays AI-generated suggestions for continuing the user's sentence.
 * Automatically fetches suggestions after a pause in speaking.
 */
export const SuggestionBox = forwardRef<SuggestionBoxRef, SuggestionBoxProps>(
  ({ transcript, interimTranscript, messages, isRecording }, ref) => {
    const [suggestion, setSuggestion] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastTranscriptRef = useRef<string>('');
    const messagesRef = useRef<ChatMessage[]>(messages);

    // Keep messagesRef in sync with props
    useEffect(() => {
      messagesRef.current = messages;
    }, [messages]);

    // Expose stop method to parent
    useImperativeHandle(ref, () => ({
      stop: () => {
        clearPauseTimer();
        abortRequest();
        setSuggestion('');
        setIsLoading(false);
      },
    }));

    const clearPauseTimer = () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };

    const abortRequest = () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };

    const fetchSuggestion = async (currentTranscript: string) => {
      // Don't fetch if there's no transcript content
      if (!currentTranscript.trim()) return;

      // Abort any pending request
      abortRequest();

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      setIsLoading(true);

      try {
        const response = await fetch(`${BACKEND_BASE_URL}/suggestion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partial_transcript: currentTranscript,
            history: messagesRef.current,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to get suggestion');
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        if (data.suggestion) {
          setSuggestion(data.suggestion);
        }
      } catch (err: any) {
        // Ignore abort errors
        if (err.name !== 'AbortError') {
          console.error('Error fetching suggestion:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const resetPauseTimer = (currentTranscript: string) => {
      clearPauseTimer();

      // Set a new timer to fetch suggestion
      pauseTimerRef.current = setTimeout(() => {
        fetchSuggestion(currentTranscript);
      }, SUGGESTION_DELAY_MS);
    };

    // Watch for transcript changes and reset the pause timer
    useEffect(() => {
      if (!isRecording) return;

      const combinedTranscript = transcript + (interimTranscript ? ' ' + interimTranscript : '');
      
      // Only reset timer if transcript actually changed
      if (combinedTranscript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = combinedTranscript;
        resetPauseTimer(combinedTranscript);
      }

      return () => {
        clearPauseTimer();
      };
    }, [transcript, interimTranscript, isRecording]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        clearPauseTimer();
        abortRequest();
      };
    }, []);

    // Reset when recording stops
    useEffect(() => {
      if (!isRecording) {
        clearPauseTimer();
        abortRequest();
        setSuggestion('');
        setIsLoading(false);
        lastTranscriptRef.current = '';
      }
    }, [isRecording]);

    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Try saying:</Text>
        {isLoading ? (
          <Text style={styles.loadingText}>Thinking...</Text>
        ) : suggestion ? (
          <Text style={styles.suggestionText}>{suggestion}</Text>
        ) : (
          <Text style={styles.placeholderText}>Pause speaking for a suggestion...</Text>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2d4a3e',
    borderRadius: 16,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  suggestionText: {
    fontSize: 18,
    color: '#7dd3a8',
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 16,
    color: '#5a9a7d',
    fontStyle: 'italic',
  },
  placeholderText: {
    fontSize: 16,
    color: '#4a6a5e',
    fontStyle: 'italic',
  },
});
