import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import {
  RootState,
  VideoQuestion,
  ContextSegment,
  QuizType,
} from "../../types";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import ReviewChat from "./ReviewChat";
import { useSupabaseWithClerk } from "../../../utils/supabase";

const CEFR_ORDER: Record<string, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
  C2: 5,
};

interface DiscussTabProps {
  onPlayClip: (start: number) => void;
  isKeyboardVisible: boolean;
  setShowVideo: (show: boolean) => void;
}

const DiscussTab: React.FC<DiscussTabProps> = ({
  onPlayClip,
  isKeyboardVisible,
  setShowVideo,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const supabase = useSupabaseWithClerk();

  const [questions, setQuestions] = useState<VideoQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [selectedQuizType, setSelectedQuizType] =
    useState<QuizType>("Comprehension");

  // Look up the database record ID from the YouTube video_id
  const dbRecordId = currentVideo
    ? allVideos.find((v) => v.video_id === currentVideo.videoId)?.id
    : null;

  // Fetch video questions from Supabase when video changes
  useEffect(() => {
    if (!supabase || !dbRecordId) {
      setQuestions([]);
      return;
    }

    const fetchQuestions = async () => {
      setQuestionsLoading(true);
      try {
        const { data, error } = await supabase
          .from("video_question")
          .select("id, video_id, cefr_level, question, answer")
          .eq("video_id", dbRecordId);

        if (error) {
          console.error("Error fetching video questions:", error);
          setQuestions([]);
          return;
        }

        // Sort by CEFR level: A2 -> B1 -> B2
        const sorted = (data as VideoQuestion[]).sort((a, b) => {
          const aOrder = CEFR_ORDER[a.cefr_level] ?? 99;
          const bOrder = CEFR_ORDER[b.cefr_level] ?? 99;
          return aOrder - bOrder;
        });

        setQuestions(sorted);
        setCurrentQuestionIndex(0);
      } catch (err) {
        console.error("Error fetching video questions:", err);
        setQuestions([]);
      } finally {
        setQuestionsLoading(false);
      }
    };

    fetchQuestions();
  }, [supabase, dbRecordId]);

  // Handle clicking a context segment timestamp
  const handlePlayClip = useCallback(
    (segment: ContextSegment) => {
      setShowVideo(true);
      onPlayClip(segment.start);
    },
    [onPlayClip],
  );

  // Navigate between questions
  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, questions.length - 1));
  }, [questions.length]);

  const handlePrevQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  if (!currentVideo) {
    return (
      <View style={styles.noVideoContainer}>
        <SelectVideoPrompt
          title="No Video Selected"
          subtitle="Select a video first to start reviewing"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ReviewChat
        questions={questions}
        currentQuestionIndex={currentQuestionIndex}
        questionsLoading={questionsLoading}
        videoId={currentVideo.videoId}
        onNextQuestion={handleNextQuestion}
        onPrevQuestion={handlePrevQuestion}
        onPlayClip={handlePlayClip}
        isKeyboardVisible={isKeyboardVisible}
        selectedQuizType={selectedQuizType}
        onSelectQuizType={setSelectedQuizType}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  noVideoContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
});

export default DiscussTab;
