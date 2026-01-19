import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBubbleProps {
  message: ChatMessage;
}

interface TranscriptBubbleProps {
  transcript: string;
  interimTranscript: string;
}

interface LoadingBubbleProps {}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <View
      style={[
        styles.messageBubble,
        isUser ? styles.userBubble : styles.assistantBubble,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          isUser ? styles.userMessageText : styles.assistantMessageText,
        ]}
      >
        {message.content}
      </Text>
    </View>
  );
};

export const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({
  transcript,
  interimTranscript,
}) => {
  if (!transcript && !interimTranscript) return null;

  return (
    <View style={[styles.messageBubble, styles.userBubble, styles.transcriptBubble]}>
      <Text style={[styles.messageText, styles.userMessageText]}>
        {transcript}
        {interimTranscript && (
          <Text style={styles.interimText}> {interimTranscript}</Text>
        )}
      </Text>
    </View>
  );
};

export const LoadingBubble: React.FC<LoadingBubbleProps> = () => {
  return (
    <View style={[styles.messageBubble, styles.assistantBubble]}>
      <ActivityIndicator color="#4a69bd" size="small" />
    </View>
  );
};

const styles = StyleSheet.create({
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginVertical: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4a69bd',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#16213e',
    borderBottomLeftRadius: 4,
  },
  transcriptBubble: {
    opacity: 0.8,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#4a69bd',
    backgroundColor: 'transparent',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#e0e0e0',
  },
  interimText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
  },
});
