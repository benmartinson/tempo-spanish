import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { useSelector, useDispatch } from 'react-redux';

import { ChatBubble, TranscriptBubble, LoadingBubble, ChatMessage } from '../ChatBubble';
import { RecordButton, RecordStatus } from '../RecordButton';
import { useAutocorrect } from '../useAutocorrect';
import { SuggestionBox } from '../SuggestionBox';
import { Answer, RootState, VideoContext } from '../../types';
import { setCurrentVideo, setNextSegment, refreshVideoPlayer } from '../../store/actions/dataActions';
import {
  BACKEND_BASE_URL,
  connectToBackend,
  startAudioStreaming,
  getRecordingConfig,
  requestMicrophonePermission,
  setAudioModeForRecording,
  playAudio,
} from '../streaming_helpers';
import ChatSelection from '../discuss/ChatSelection';
import { MultipleChoice } from '../MultipleChoice';
import { getVideoTitle } from '../../data/question_clips';
import { useNavigation } from '@react-navigation/native';

interface ChatProps {
  chatType?: "general" | "video-based" | null;
}

const Chat: React.FC<ChatProps> = ({ chatType = null }) => {
  const navigation = useNavigation();
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [multipleChoiceAnswers, setMultipleChoiceAnswers] = useState<Answer[]>([]);
  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [isLoadingInitialMessage, setIsLoadingInitialMessage] = useState(true);


  // Chat type selection state
  const dispatch = useDispatch();
  const currentChatType = useSelector((state: RootState) => state.currentChatType);
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const finalTranscriptRef = useRef<string>('');

  // Format seconds to video timestamp (MM:SS or HH:MM:SS)
  // const formatVideoTimestamp = (seconds: number): string => {
  //   const totalSeconds = Math.floor(seconds);
  //   const hours = Math.floor(totalSeconds / 3600);
  //   const minutes = Math.floor((totalSeconds % 3600) / 60);
  //   const secondsPart = totalSeconds % 60;

  //   if (hours > 0) {
  //     return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secondsPart.toString().padStart(2, '0')}`;
  //   } else {
  //     return `${minutes.toString().padStart(2, '0')}:${secondsPart.toString().padStart(2, '0')}`;
  //   }
  // };

  // Autocorrect hook for real-time transcript corrections
  const autocorrect = useAutocorrect({
    setTranscript,
    finalTranscriptRef,
  });

  useEffect(() => {
    // Request microphone permission on mount
    requestPermission();

    // Initialize with an AI-generated engaging prompt
    if (currentChatType === 'general') {
      initializeWithPrompt();
    } else {
      generateVideoBasedQuestion();
    }

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [currentVideo.currentSegment]);

  // Auto-scroll the transcription box when transcript changes
  useEffect(() => {
    if (scrollViewRef.current) {
      // Small delay to ensure the content has been rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [transcript, interimTranscript]);

  const handleCorrectAnswer = () => {
    setMultipleChoiceAnswers([]);
    setMessages([]);
    dispatch(setNextSegment());
    navigation.navigate('Watch' as never);
  };

  const generateVideoBasedQuestion = async () => {
    if (!currentVideo) {
      setError('No video selected');
      return;
    }
    const response = await fetch(`${BACKEND_BASE_URL}/video-based-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: currentVideo.videoId,
        segments: [currentVideo.segments[currentVideo.currentSegment]],
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate video-based question');
    }

    const data = await response.json();
    setMessages([{ role: 'assistant', content: data.question }]);
    setMultipleChoiceAnswers(data.answers.map((answer: string, index: number) => ({ answer, correct: index === data.correct_answer })));

    // Play audio if available
    if (data.audio) {
      await playAudio(data.audio);
    }
  };



  const initializeWithPrompt = async () => {
    setIsLoadingInitialMessage(true);
    try {
      // Call the dedicated initial message endpoint
      const response = await fetch(`${BACKEND_BASE_URL}/initial-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get initial message');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Add the AI-generated prompt as the first message
      if (data.response) {
        const initialMessage: ChatMessage = {
          role: 'assistant',
          content: data.response
        };
        setMessages([initialMessage]);
        
        // Play audio if available
        if (data.audio) {
          await playAudio(data.audio);
        }
      }
    } catch (err) {
      console.error('Error getting initial prompt:', err);
      // Fallback to a simple prompt if API fails
      const fallbackMessage: ChatMessage = {
        role: 'assistant',
        content: "¿Qué tal estás hoy? Cuéntame algo interesante sobre ti."
      };
      setMessages([fallbackMessage]);
    } finally {
      setIsLoadingInitialMessage(false);
    }
  };

  const requestPermission = async () => {
    try {
      const granted = await requestMicrophonePermission();
      setHasPermission(granted);
      if (!granted) {
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
    // Stop autocorrect
    autocorrect.stop();
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

  const handleTranscript = (transcriptText: string, isFinal: boolean) => {
    if (isFinal) {
      // Final transcript - append to permanent transcript
      setTranscript((prev) => {
        const newTranscript = prev + (prev ? ' ' : '') + transcriptText;
        finalTranscriptRef.current = newTranscript;
        return newTranscript;
      });
      setInterimTranscript('');
    } else {
      // Interim result - show as temporary
      setInterimTranscript(transcriptText);
    }
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
    finalTranscriptRef.current = '';

    try {
      // Connect to backend server first
      wsRef.current = await connectToBackend({
        onTranscript: handleTranscript,
        onError: (message) => setError(message),
      });

      // Configure audio mode
      await setAudioModeForRecording(true);

      // Create recording with PCM format
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(getRecordingConfig());

      recordingRef.current = recording;
      await recording.startAsync();
      setIsRecording(true);
      setIsConnecting(false);

      // Start autocorrect interval
      autocorrect.start();

      // Start streaming audio chunks to backend server
      streamIntervalRef.current = startAudioStreaming(
        () => recordingRef.current,
        () => wsRef.current
      );
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Please try again.');
      setIsConnecting(false);
      cleanup();
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    // Stop the streaming interval first
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    // Stop autocorrect
    autocorrect.stop();

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
    // Then send the transcript to the chat
    setTimeout(() => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Get the final transcript from the ref and send to chat
      const transcriptToSend = finalTranscriptRef.current.trim();
      if (transcriptToSend) {
        sendToChat(transcriptToSend);
      }

      // Clear the transcript and ref
      setTranscript('');
      setInterimTranscript('');
      finalTranscriptRef.current = '';
    }, 1500);

    // Reset audio mode
    await setAudioModeForRecording(false);
  };

  const clearConversation = async () => {
    setMessages([]);
    setTranscript('');
    setInterimTranscript('');
    // Start a new conversation with a fresh AI-generated prompt
    await initializeWithPrompt();
  };

  const sendToChat = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    // Add user message to conversation
    const newUserMessage: ChatMessage = { role: 'user', content: userMessage };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoadingResponse(true);

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from chat');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Add assistant message to conversation
      if (data.response) {
        const assistantMessage: ChatMessage = { role: 'assistant', content: data.response };
        setMessages((prev) => [...prev, assistantMessage]);
        // Auto-scroll to bottom
        scrollViewRef.current?.scrollToEnd({ animated: true });
        
        // Play audio if available
        if (data.audio) {
          await playAudio(data.audio);
        }
      }
    } catch (err) {
      console.error('Error sending to chat:', err);
      setError('Failed to get AI response. Please try again.');
    } finally {
      setIsLoadingResponse(false);
    }
  };

  const restartRecording = async () => {
    // Clear current transcript
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';

    // If currently recording, stop first
    if (isRecording) {
      await stopRecording();
    }

    // Small delay to ensure cleanup is complete, then start recording
    setTimeout(() => {
      startRecording();
    }, 100);
  };

  const handleRecordPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  // Chat interface
  return (
    <View style={styles.container}>
      {/* <View style={styles.header}>
        <Text style={styles.title}>{currentChatType === 'general' ? 'General Chat' : `Discuss ${getVideoTitle(currentVideo?.videoId)}`}</Text>
        {messages.length > 0 && !isRecording && (
          <TouchableOpacity style={styles.clearAllButton} onPress={clearConversation}>
            <Text style={styles.clearAllButtonText}>Clear Conversation</Text>
          </TouchableOpacity>
        )}
      </View> */}

      {isRecording || isConnecting ? (
        /* Recording Overlay */
        <View style={styles.recordingOverlay}>
          {/* Transcription Section - Largest */}
          <View style={styles.transcriptionSection}>
            <Text style={styles.sectionLabel}>What you're saying:</Text>
            <ScrollView ref={scrollViewRef} style={styles.transcriptionScroll}>
              <Text style={styles.transcriptionText}>
                {transcript}
                {interimTranscript && (
                  <Text style={styles.interimText}> {interimTranscript}</Text>
                )}
                {!transcript && !interimTranscript && (
                  <Text style={styles.placeholderText}>Start speaking...</Text>
                )}
              </Text>
            </ScrollView>
          </View>

          {/* Suggestion Section */}
          <SuggestionBox
            transcript={transcript}
            interimTranscript={interimTranscript}
            messages={messages}
            isRecording={isRecording}
          />

          {/* Vocab Words Section */}
          {/* <View style={styles.vocabSection}>
            <Text style={styles.sectionLabel}>Vocabulary to use:</Text>
            <View style={styles.vocabList}>
              {vocabWords.map((word, index) => (
                <View key={index} style={styles.vocabChip}>
                  <Text style={styles.vocabChipText}>{word}</Text>
                </View>
              ))}
            </View>
          </View> */}
        </View>
      ) : (
        /* Normal Chat View */
        <Animated.ScrollView
          ref={scrollViewRef}
          style={styles.chatContainer}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && isLoadingInitialMessage ? (
            <View style={styles.loadingContainer}>
              <LoadingBubble />
              <Text style={styles.loadingText}>Preparing conversation...</Text>
            </View>
          ) : (
            <>
              {/* Render conversation messages */}
              {messages.map((msg, index) => (
                <ChatBubble key={index} message={msg} />
              ))}

              {/* Multiple choice answers */}
              {multipleChoiceAnswers.length > 0 && (
                <MultipleChoice answers={multipleChoiceAnswers} onCorrectAnswer={handleCorrectAnswer}/>
              )}

              {currentVideo && (
                <View style={styles.questionContextContainer}>
                  <TouchableOpacity style={styles.questionContextButton} onPress={() => {
                    dispatch(refreshVideoPlayer());
                    navigation.navigate('Watch' as never);
                  }}>
                    <Text style={styles.questionContextText}>Watch Again 🔙</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Show loading indicator while waiting for response */}
              {isLoadingResponse && <LoadingBubble />}
            </>
          )}
        </Animated.ScrollView>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.controlsContainer}>
        <View style={styles.buttonRow}>
          <RecordButton
            isRecording={isRecording}
            isConnecting={isConnecting}
            isDisabled={hasPermission === false || isLoadingResponse}
            onPress={handleRecordPress}
          />
          {isRecording && (
            <TouchableOpacity
              style={styles.restartButton}
              onPress={restartRecording}
              disabled={isConnecting || hasPermission === false}
            >
              <Text style={styles.restartButtonText}>⟲</Text>
            </TouchableOpacity>
          )}
        </View>
        <RecordStatus
          isConnecting={isConnecting}
          isRecording={isRecording}
          isLoadingResponse={isLoadingResponse}
        />
      </View>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 5,
    width: '100%',
  },
  questionContextContainer: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#333',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  questionContextButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  questionContextText: {
    color: '#888',
    fontSize: 12,
  },
  clearAllButton: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#333',
    borderRadius: 16,
  },
  clearAllButtonText: {
    color: '#888',
    fontSize: 12,
  },
  chatContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginVertical: 10,
  },
  chatContent: {
    flexGrow: 1,
    paddingVertical: 10,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
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
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  restartButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffa726',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffa726',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  restartButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Recording Overlay Styles
  recordingOverlay: {
    flex: 1,
    marginHorizontal: 12,
    marginVertical: 10,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Transcription Section - Largest
  transcriptionSection: {
    flex: 3,
    backgroundColor: '#252542',
    borderRadius: 16,
    padding: 16,
  },
  transcriptionScroll: {
    flex: 1,
  },
  transcriptionText: {
    fontSize: 20,
    color: '#fff',
    lineHeight: 28,
  },
  interimText: {
    color: '#888',
    fontStyle: 'italic',
  },
  placeholderText: {
    color: '#555',
    fontStyle: 'italic',
  },
  // Vocab Section
  vocabSection: {
    flex: 1.2,
    backgroundColor: '#3d3a52',
    borderRadius: 16,
    padding: 16,
  },
  vocabList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vocabChip: {
    backgroundColor: '#5a5680',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  vocabChipText: {
    color: '#e0d9ff',
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    backgroundColor: '#3d3a52',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5a5680',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Chat;
