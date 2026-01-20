import { useCallback } from 'react';

interface UseAutocorrectProps {
  setTranscript: React.Dispatch<React.SetStateAction<string>>;
  finalTranscriptRef: React.MutableRefObject<string>;
}

interface UseAutocorrectReturn {
  start: () => void;
  stop: () => void;
}

/**
 * Hook that manages automatic transcript correction during recording.
 * Currently disabled - returns no-op functions.
 */
export const useAutocorrect = ({
  setTranscript: _setTranscript,
  finalTranscriptRef: _finalTranscriptRef,
}: UseAutocorrectProps): UseAutocorrectReturn => {
  const start = useCallback(() => {
    // Autocorrect disabled
  }, []);

  const stop = useCallback(() => {
    // Autocorrect disabled
  }, []);

  return { start, stop };
};
