import { useState, useRef, useCallback } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { extractWavSegment } from "../helpers/wav_segment_extractor";
import { sendAudioForTranscription } from "../helpers/streaming_helpers";
import { calculateAccuracy } from "../helpers/calculate_accuracy";
import { AccuracyResult, Sentence } from "../types";

export interface SegmentResult {
  segmentIndex: number;
  segmentText: string;
  percentage: number;
  status: "processing" | "complete" | "error";
  accuracyResult?: AccuracyResult;
}

interface UseSpeedRunSessionOptions {
  targetLanguage: string;
  properNouns: string[];
}

export const useSpeedRunSession = ({
  targetLanguage,
  properNouns,
}: UseSpeedRunSessionOptions) => {
  const [results, setResults] = useState<SegmentResult[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const segmentStartTimeRef = useRef<number>(0);

  const startSession = useCallback(() => {
    setResults([]);
    recordingStartTimeRef.current = Date.now();
    segmentStartTimeRef.current = 0;
  }, []);

  const processSegment = useCallback(
    async (
      recorderUri: string,
      sentence: Sentence,
      startSeconds: number,
      endSeconds: number,
    ) => {
      const segmentIndex = sentence.index;

      setResults((prev) => [
        ...prev,
        {
          segmentIndex,
          segmentText: sentence.text,
          percentage: 0,
          status: "processing",
        },
      ]);

      let segmentUri: string | null = null;
      try {
        segmentUri = await extractWavSegment(
          recorderUri,
          startSeconds,
          endSeconds,
        );

        const transcription = await sendAudioForTranscription(
          segmentUri,
          targetLanguage,
        );

        const spokenWords = transcription.transcript
          .split(/\s+/)
          .filter(Boolean);
        const targetWords = sentence.text.split(/\s+/).filter(Boolean);

        const accuracy = calculateAccuracy(
          spokenWords,
          targetWords,
          properNouns,
        );

        setResults((prev) =>
          prev.map((r) =>
            r.segmentIndex === segmentIndex
              ? {
                  ...r,
                  percentage: accuracy.percentage,
                  status: "complete",
                  accuracyResult: accuracy,
                }
              : r,
          ),
        );
      } catch (err) {
        console.error(`Speed run segment ${segmentIndex} error:`, err);
        setResults((prev) =>
          prev.map((r) =>
            r.segmentIndex === segmentIndex ? { ...r, status: "error" } : r,
          ),
        );
      } finally {
        if (segmentUri) {
          FileSystem.deleteAsync(segmentUri, { idempotent: true }).catch(
            () => {},
          );
        }
      }
    },
    [targetLanguage, properNouns],
  );

  const SEGMENT_BUFFER = 1; // extra second of audio after segment end

  const onSegmentComplete = useCallback(
    (completedSentence: Sentence, recorderUri: string) => {
      const now = (Date.now() - recordingStartTimeRef.current) / 1000;
      const startSeconds = segmentStartTimeRef.current;
      const endSeconds = now + SEGMENT_BUFFER;
      segmentStartTimeRef.current = now;

      if (now - startSeconds < 0.3) return;

      processSegment(recorderUri, completedSentence, startSeconds, endSeconds);
    },
    [processSegment],
  );

  const endSession = useCallback(
    (currentSentence: Sentence, recorderUri: string) => {
      const now = (Date.now() - recordingStartTimeRef.current) / 1000;
      const startSeconds = segmentStartTimeRef.current;

      if (now - startSeconds < 0.3) return;

      processSegment(recorderUri, currentSentence, startSeconds, now);
    },
    [processSegment],
  );

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return {
    results,
    startSession,
    onSegmentComplete,
    endSession,
    clearResults,
  };
};
