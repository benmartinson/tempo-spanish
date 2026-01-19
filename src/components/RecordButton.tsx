import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

interface RecordButtonProps {
  isRecording: boolean;
  isConnecting: boolean;
  isDisabled: boolean;
  onPress: () => void;
}

interface RecordStatusProps {
  isConnecting: boolean;
  isRecording: boolean;
  isLoadingResponse: boolean;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  isRecording,
  isConnecting,
  isDisabled,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.recordButton,
        isRecording && styles.recordingButton,
        isConnecting && styles.connectingButton,
        isDisabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={isConnecting || isDisabled}
    >
      {isConnecting ? (
        <ActivityIndicator color="#fff" size="large" />
      ) : (
        <View style={[styles.micIcon, isRecording && styles.stopIcon]} />
      )}
    </TouchableOpacity>
  );
};

export const RecordStatus: React.FC<RecordStatusProps> = ({
  isConnecting,
  isRecording,
  isLoadingResponse,
}) => {
  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isRecording) return 'Listening...';
    if (isLoadingResponse) return 'AI is responding...';
    return 'Tap to speak';
  };

  return <Text style={styles.statusText}>{getStatusText()}</Text>;
};

const styles = StyleSheet.create({
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
  disabledButton: {
    backgroundColor: '#555',
    shadowColor: '#555',
    opacity: 0.7,
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
