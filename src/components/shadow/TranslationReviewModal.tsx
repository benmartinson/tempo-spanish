import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import SlideModal from "../common/SlideModal";
import ShadowResults from "./ShadowResults";
import CountdownTimer from "./CountdownTimer";
import RecordingControls from "../common/RecordingControls";
import { useRecording } from "../../hooks/useRecording";
import { calculateAccuracy } from "../../helpers/calculate_accuracy";
import { sendAudioForTranscription } from "../../helpers/streaming_helpers";
import { AccuracyResult, RootState, SegmentWord } from "../../types";
import { capitalize } from "../../helpers/helpers";
import TranslateContent from "./TranslateContent";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { persistUserSettings } from "../../requests";
import { setUserSettings } from "../../store/actions/dataActions";

interface TranslationReviewModalProps {
  visible: boolean;
  englishTranslation: string;
  segmentDuration: number;
  targetText: string;
  targetWords: SegmentWord[];
  properNouns: string[];
  onComplete: () => void;
  onClose: () => void;
}

const TranslationReviewModal: React.FC<TranslationReviewModalProps> = ({
  visible,
  englishTranslation,
  segmentDuration,
  targetText,
  targetWords,
  properNouns,
  onComplete,
  onClose,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const targetLanguage = useSelector(
    (state: RootState) => state.userSettings.targetLanguage,
  );
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const [userAnswer, setUserAnswer] = useState("");
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(
    null,
  );
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUpdatingReviewFrequency, setIsUpdatingReviewFrequency] =
    useState(false);

  useEffect(() => {
    handleReset();
  }, [englishTranslation]);

  const evaluateWords = (spokenWords: string[]) => {
    const target = targetWords.map((w) => w.word);
    const result = calculateAccuracy(spokenWords, target, properNouns);
    setAccuracyResult({
      ...result,
      targetSentence: capitalize(targetText),
    });
  };

  const { isRecording, startRecording, stopRecording } = useRecording({
    onRecordingComplete: async (audioUri: string) => {
      setIsTranscribing(true);
      try {
        if (!targetLanguage) {
          throw new Error("Target language has not loaded yet.");
        }
        const transcriptionResult = await sendAudioForTranscription(
          audioUri,
          targetLanguage,
        );
        const spokenWords = transcriptionResult.transcript
          .split(/\s+/)
          .filter(Boolean);
        evaluateWords(spokenWords);
      } catch (err) {
        console.error("Transcription error:", err);
      } finally {
        setIsTranscribing(false);
      }
    },
    onError: (message) => console.error("Recording error:", message),
  });

  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const estimatedDuration = useMemo(
    () => Math.max(3, englishTranslation.split(/\s+/).length * 0.8),
    [englishTranslation],
  );

  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 0.1);
      }, 100);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const handleReset = () => {
    setUserAnswer("");
    setAccuracyResult(null);
    setIsEvaluating(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleComplete = () => {
    handleReset();
    onComplete();
  };

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;
    Keyboard.dismiss();
    setIsEvaluating(true);
    const typedWords = userAnswer.trim().split(/\s+/);
    evaluateWords(typedWords);
    setIsEvaluating(false);
  };

  const handleSeeLessOften = async () => {
    if (isUpdatingReviewFrequency) return;
    const nextReviewFrequency = userSettings.reviewFrequency + 1;
    const updatedSettings = {
      ...userSettings,
      reviewFrequency: nextReviewFrequency,
    };

    setIsUpdatingReviewFrequency(true);
    dispatch(setUserSettings(updatedSettings));
    try {
      await persistUserSettings({
        supabase,
        userId,
        settings: { reviewFrequency: nextReviewFrequency },
      });
    } finally {
      setIsUpdatingReviewFrequency(false);
      handleClose();
    }
  };

  const handleStartRecordingFlow = () => {
    startRecording();
  };

  const handleSubmitRecording = () => {
    setIsTranscribing(true);
    stopRecording(false);
  };

  const handleTrashRecording = () => {
    stopRecording(true);
  };
  console.log({ englishTranslation });

  return (
    <SlideModal
      visible={visible}
      onRequestClose={handleClose}
      title="Translate this sentence"
    >
      <View style={styles.content}>
        <TranslateContent
          translationText={englishTranslation}
          isLoading={false}
          time={recordingTime}
          playerIsPlaying={isRecording}
          segmentStart={0}
          segmentEnd={estimatedDuration}
        />

        {!accuracyResult && (
          <>
            {!isRecording && !isEvaluating && !isTranscribing && (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Type your translation..."
                  placeholderTextColor="#999"
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  multiline
                  autoCorrect={false}
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={() => {
                    if (userAnswer.trim()) handleSubmit();
                  }}
                />
                {userAnswer.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setUserAnswer("")}
                  >
                    <Entypo name="cross" size={16} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isEvaluating || isTranscribing ? (
              <ActivityIndicator size="large" color="#4a69bd" />
            ) : (
              <>
                {isRecording ? (
                  <CountdownTimer
                    onStartRecording={() => {}}
                    onStopRecording={handleSubmitRecording}
                    onTrash={handleTrashRecording}
                    maxRecordingDuration={segmentDuration}
                    bufferDuration={5}
                  />
                ) : (
                  <View style={styles.actionsRow}>
                    <View style={styles.reviewActionsGroup}>
                      <TouchableOpacity
                        style={[styles.reviewButton, styles.skipButton]}
                        onPress={handleClose}
                      >
                        <Text style={styles.skipButtonText}>Skip</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.reviewButton,
                          styles.lessOftenButton,
                          isUpdatingReviewFrequency &&
                            styles.reviewButtonDisabled,
                        ]}
                        onPress={handleSeeLessOften}
                        disabled={isUpdatingReviewFrequency}
                      >
                        <Text style={styles.lessOftenButtonText}>
                          See These Less Often
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.recordingAction}>
                      <RecordingControls
                        isRecording={false}
                        onMic={handleStartRecordingFlow}
                        onTrash={() => {}}
                        disabled={isTranscribing || isUpdatingReviewFrequency}
                        showContainer={false}
                        hideTrash
                      />
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {accuracyResult && (
          <ShadowResults
            accuracyResult={accuracyResult}
            handleNextSentence={handleComplete}
            handleRetry={handleReset}
            spokenLabel="Your answer: "
            targetLabel="Target: "
            hideRetry={false}
            alwaysShowNext
            nextButtonLabel="Continue"
            noMarginTop
          />
        )}
      </View>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 20,
  },
  promptLabel: {
    fontSize: 16,
    color: "#555",
    fontWeight: "500",
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    paddingRight: 32,
    fontSize: 16,
    color: "#222",
    minHeight: 60,
    textAlignVertical: "top",
  },
  clearButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewActionsGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingAction: {
    flexShrink: 0,
  },
  reviewButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
    borderWidth: 1,
    borderColor: "#d0d8f0",
    backgroundColor: "#fff",
  },
  lessOftenButton: {
    flex: 1,
    backgroundColor: "#4a69bd",
  },
  reviewButtonDisabled: {
    opacity: 0.5,
  },
  skipButtonText: {
    color: "#4a69bd",
    fontSize: 15,
    fontWeight: "600",
  },
  lessOftenButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default TranslationReviewModal;
