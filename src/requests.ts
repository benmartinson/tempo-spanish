import { BACKEND_BASE_URL } from "./components/streaming_helpers";
import {
  ContextSegment,
  Evaluation,
  VocabEvaluation,
} from "./types";

export interface FetchReviewContextParams {
  searchQuery: string;
  videoId: string;
}

export const fetchReviewContext = async ({
  searchQuery,
  videoId,
}: FetchReviewContextParams): Promise<ContextSegment[]> => {
  const response = await fetch(`${BACKEND_BASE_URL}/review-context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      search_query: searchQuery,
      video_id: videoId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error fetching context: ${response.status}`);
  }

  const data = await response.json();
  return data.segments || [];
};

export interface EvaluateVocabAnswerParams {
  question: string;
  userAnswer: string;
  contextSegments: { text: string }[];
  vocabWord: string;
}

export const evaluateVocabAnswer = async ({
  question,
  userAnswer,
  contextSegments,
  vocabWord,
}: EvaluateVocabAnswerParams): Promise<VocabEvaluation | null> => {
  const response = await fetch(`${BACKEND_BASE_URL}/evaluate-vocab-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      user_answer: userAnswer,
      context_segments: contextSegments,
      vocab_word: vocabWord,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error evaluating vocab answer: ${response.status}`);
  }

  const data = await response.json();
  if (data.score && data.accepted_answers) {
    return {
      score: data.score,
      acceptedAnswers: data.accepted_answers,
    };
  }
  return null;
};

export interface EvaluateReviewAnswerParams {
  question: string;
  idealAnswer: string;
  userAnswer: string;
  contextSegments: { text: string }[];
}

export const evaluateReviewAnswer = async ({
  question,
  idealAnswer,
  userAnswer,
  contextSegments,
}: EvaluateReviewAnswerParams): Promise<Evaluation | null> => {
  const response = await fetch(`${BACKEND_BASE_URL}/evaluate-review-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      ideal_answer: idealAnswer,
      user_answer: userAnswer,
      context_segments: contextSegments,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error evaluating answer: ${response.status}`);
  }

  const data = await response.json();
  if (data.feedback && data.score) {
    return { feedback: data.feedback, score: data.score };
  }
  return null;
};
