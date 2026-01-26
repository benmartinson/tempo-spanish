import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Answer } from '../types';

interface MultipleChoiceProps {
  answers: Answer[];
  onCorrectAnswer: () => void;
}

export const MultipleChoice: React.FC<MultipleChoiceProps> = ({ answers, onCorrectAnswer }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [answerFeedback, setAnswerFeedback] = useState<string>('');
  const correctAnswer = answers.find((answer) => answer.correct === true)?.answer;

  const handleMultipleChoiceAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    if (answer === correctAnswer) {
      setAnswerFeedback('Correct!');
      setTimeout(() => {
        onCorrectAnswer();
      }, 1000);
    } else {
      setAnswerFeedback('Not Quite!');
    }
  };

  return (
    <View style={styles.multipleChoiceContainer}>
      {answers.map((answer, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.multipleChoiceButton,
            selectedAnswer === answer.answer && selectedAnswer === correctAnswer && styles.correctButton,
            selectedAnswer === answer.answer && selectedAnswer !== correctAnswer && styles.incorrectButton,
          ]}
          onPress={() => handleMultipleChoiceAnswer(answer.answer)}
        >
          <Text style={[
            styles.multipleChoiceButtonText,
            selectedAnswer === answer.answer && styles.selectedButtonText,
          ]}>
            {answer.answer}
          </Text>
        </TouchableOpacity>
      ))}
      {answerFeedback !== '' && (
        <Text style={[
          styles.feedbackText,
          answerFeedback === 'Correct!' ? styles.correctFeedback : styles.incorrectFeedback
        ]}>
          {answerFeedback}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  multipleChoiceContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    gap: 12,
  },
  multipleChoiceButton: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  correctButton: {
    backgroundColor: '#2e7d32',
    borderColor: '#4caf50',
  },
  incorrectButton: {
    backgroundColor: '#c62828',
    borderColor: '#f44336',
  },
  multipleChoiceButtonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  selectedButtonText: {
    fontWeight: 'bold',
  },
  feedbackText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  correctFeedback: {
    color: '#4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  incorrectFeedback: {
    color: '#f44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
});