import { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AccuracyResult } from "../../types";
import {
  generateTTS,
  playAudioSequence,
  playAudio,
} from "../streaming_helpers";
import { getResponseForPercentage } from "../../helpers";
import { setCachedResponses } from "../../store/actions/dataActions";
import { SupabaseClient } from "@supabase/supabase-js";

export function useCachedAudio(
  supabase: SupabaseClient | null,
  setIsSpeakingResponse: (value: boolean) => void,
  startListeningRef?: React.MutableRefObject<() => void>,
) {
  const cachedResponses = useSelector(
    (state: RootState) => state.cachedResponses,
  );
  const dispatch = useDispatch();

  const getOrCreatePhraseRecording = useCallback(
    async (phrase: string): Promise<string | null> => {
      const existing = cachedResponses.find((r) => r.response_text === phrase);
      if (existing?.recording) return existing.recording;

      try {
        const base64 = await generateTTS(phrase);
        if (supabase) {
          const { data } = await supabase
            .from("cached_response")
            .insert({ response_text: phrase, recording: base64 })
            .select()
            .single();
          if (data) {
            dispatch(setCachedResponses([...cachedResponses, data]));
          }
        }
        return base64;
      } catch (err) {
        console.error(`Error generating TTS for "${phrase}":`, err);
        return null;
      }
    },
    [cachedResponses, supabase, dispatch],
  );

  const playCachedResponse = useCallback(
    async (accuracy: AccuracyResult) => {
      const responseText = getResponseForPercentage(accuracy.percentage);
      const cached = cachedResponses.find(
        (r) => r.response_text === responseText,
      );
      if (!cached?.recording) return;

      const clips: string[] = [cached.recording];

      setIsSpeakingResponse(true);
      await playAudioSequence(clips);
      setIsSpeakingResponse(false);
      startListeningRef?.current();
    },
    [cachedResponses, setIsSpeakingResponse, startListeningRef],
  );

  const playResultsReview = useCallback(
    async (accuracy: AccuracyResult) => {
      // 100%: just say "You got 100% correct!"
      if (Math.round(accuracy.percentage) >= 100) {
        const perfect = cachedResponses.find(
          (r) => r.response_text === "You got 100% correct!",
        );
        if (perfect?.recording) {
          setIsSpeakingResponse(true);
          await playAudioSequence([perfect.recording]);
          setIsSpeakingResponse(false);
        }
        return;
      }

      // Group consecutive unmatched words into phrases
      const unmatchedPhrases: string[] = [];
      let currentPhrase: string[] = [];
      for (const detail of accuracy.details) {
        if (!detail.matched || detail._matchScore === 0) {
          currentPhrase.push(detail.targetWord);
        } else {
          if (currentPhrase.length > 0) {
            unmatchedPhrases.push(currentPhrase.join(" "));
            currentPhrase = [];
          }
        }
      }
      if (currentPhrase.length > 0) {
        unmatchedPhrases.push(currentPhrase.join(" "));
      }

      // Find words with spelling errors
      const misspelled = accuracy.details.filter(
        (d) =>
          d.matched &&
          d._matchScore !== undefined &&
          d._matchScore > 0 &&
          d._matchScore < 1 &&
          d.spokenWord &&
          d.spokenWord.toLowerCase() !== d.targetWord.toLowerCase(),
      );

      // Build the full text to speak
      const parts: string[] = [];

      if (unmatchedPhrases.length === 1) {
        parts.push(`Te faltó la palabra "${unmatchedPhrases[0]}"`);
      } else if (unmatchedPhrases.length > 1) {
        const last = `"${unmatchedPhrases[unmatchedPhrases.length - 1]}"`;
        const rest = unmatchedPhrases
          .slice(0, -1)
          .map((p) => `"${p}"`)
          .join(", ");
        parts.push(`Te faltaron las palabras ${rest}, y ${last}`);
      }

      if (misspelled.length === 1) {
        parts.push(
          `Usted dijo "${misspelled[0].spokenWord}" en vez de "${misspelled[0].targetWord}"`,
        );
      } else if (misspelled.length > 1) {
        const pairs = misspelled.map(
          (d) => `"${d.spokenWord}" en vez de "${d.targetWord}"`,
        );
        const last = pairs[pairs.length - 1];
        const rest = pairs.slice(0, -1).join(", ");
        parts.push(`Usted dijo ${rest}, y ${last}`);
      }

      const fullText = parts.join(". ");
      if (!fullText) return;

      const recording = await getOrCreatePhraseRecording(fullText);
      if (recording) {
        setIsSpeakingResponse(true);
        await playAudio(recording);
        setIsSpeakingResponse(false);
      }
    },
    [cachedResponses, getOrCreatePhraseRecording, setIsSpeakingResponse],
  );

  return {
    getOrCreatePhraseRecording,
    playCachedResponse,
    playResultsReview,
  };
}
