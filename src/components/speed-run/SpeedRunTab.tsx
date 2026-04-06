import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { RootState, SegmentWord, Sentence } from "../../types";
import { useSelector } from "react-redux";
import FullSegmentTranscriptBubble from "../common/FullSegmentTranscriptBubble";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import NavSwitcher from "../common/NavSwitcher";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import PlayerControls from "../shadow/PlayerControls";
import { useRecording } from "../../hooks/useRecording";
import { useSpeedRunSession, SegmentResult } from "../../hooks/useSpeedRunSession";
import ShadowResults from "../shadow/ShadowResults";
import AccuracyCircle from "../common/AccuracyCircle";
import DifficultySlider from "../common/DifficultySlider";
import RecordingControls from "../common/RecordingControls";
import SettingsModal from "../shadow/SettingsModal";
import Feather from "@expo/vector-icons/Feather";

interface SpeedRunTabProps {
  time: number;
  currentSentence: Sentence;
  setCurrentSentence: React.Dispatch<React.SetStateAction<number>>;
  setAutoplay: (autoplay: boolean) => void;
  refreshPlayer: () => void;
  isActive?: boolean;
  hintWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord) => void;
  isPlayingWordSnippet: boolean;
  pausePlayer: () => void;
  resumePlayer: () => void;
  playerIsPlaying: boolean;
  setPlayerSpeed: (speed: number) => void;
  handleNextSentence: () => void;
  handlePreviousSentence: () => void;
  onPlayClip: (time: number) => void;
  playSentence: () => void;
  orderedCharacters: string[];
  targetLanguage: string;
  mutePlayer: () => void;
  unMutePlayer: () => void;
  onTimeUpdate: (time: number) => void;
  setClipEnd: (end: number | undefined) => void;
}

const getScoreColor = (percentage: number) => {
  if (percentage >= 75) return "#22c55e";
  if (percentage >= 40) return "#eab308";
  return "#ef4444";
};

const SpeedRunTab: React.FC<SpeedRunTabProps> = ({
  time,
  currentSentence,
  handleNextSentence,
  handlePreviousSentence,
  onPlayClip,
  playSentence,
  pausePlayer,
  resumePlayer,
  playerIsPlaying,
  setPlayerSpeed,
  orderedCharacters,
  targetLanguage,
  mutePlayer,
  unMutePlayer,
  setClipEnd,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const prevSentenceRef = useRef<Sentence | null>(null);
  const segmentsInChunkRef = useRef(0);
  const chunkStartIndexRef = useRef(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.25);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SegmentResult | null>(
    null,
  );
  const [showChunkResults, setShowChunkResults] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [difficulty, setDifficulty] = useState(0);
  const [revealedWords, setRevealedWords] = useState<Set<number>>(new Set());
  const [simulatedTime, setSimulatedTime] = useState<number | null>(null);

  // Chunk selection state
  const [chunkSize, setChunkSize] = useState(3);
  const [chunkSelected, setChunkSelected] = useState(false);
  const [hasListened, setHasListened] = useState(false);
  const [chunkRange, setChunkRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const handleRecordingComplete = useCallback(() => {}, []);

  const { isRecording, startRecording, stopRecording, getRecorderUri } =
    useRecording({
      onRecordingComplete: handleRecordingComplete,
    });

  const { results, startSession, onSegmentComplete, endSession, clearResults } =
    useSpeedRunSession({
      targetLanguage,
      properNouns: orderedCharacters,
    });

  const handleSelectChunk = useCallback(() => {
    if (!currentVideo) return;
    const startIdx = currentVideo.currentSentence;
    const endIdx = Math.min(
      startIdx + chunkSize - 1,
      currentVideo.sentences.length - 1,
    );
    setChunkRange({ start: startIdx, end: endIdx });
    setChunkSelected(true);
    setHasListened(false);
    playbackStartedRef.current = false;
    setClipEnd(currentVideo.sentences[endIdx]?.end);
    // Autoplay the chunk
    onPlayClip(currentVideo.sentences[startIdx]?.start);
    clearResults();
    setRevealedWords(new Set());
    setDifficulty(0);
    setShowChunkResults(false);
    setSelectedResult(null);
  }, [currentVideo, chunkSize, clearResults, setClipEnd]);

  const handleDeselectChunk = useCallback(() => {
    setChunkSelected(false);
    setShowChunkResults(false);
    setSelectedResult(null);
    setIsAnalyzing(false);
    setClipEnd(undefined);
    clearResults();
    setRevealedWords(new Set());
    setDifficulty(0);
  }, [clearResults, setClipEnd]);

  const handleChunkPrev = useCallback(() => {
    if (!currentVideo) return;
    const prevIdx = currentVideo.currentSentence - 1;
    if (prevIdx >= chunkRange.start) {
      const sentence = currentVideo.sentences[prevIdx];
      if (sentence) onPlayClip(sentence.start);
    }
  }, [currentVideo, chunkRange.start, onPlayClip]);

  const handleChunkNext = useCallback(() => {
    if (!currentVideo) return;
    const nextIdx = currentVideo.currentSentence + 1;
    if (nextIdx <= chunkRange.end) {
      const sentence = currentVideo.sentences[nextIdx];
      if (sentence) onPlayClip(sentence.start);
    }
  }, [currentVideo, chunkRange.end, onPlayClip]);

  const maskedIndices = useMemo(() => {
    const masked = new Set<number>();
    if (difficulty === 0 || !currentSentence.words) return masked;
    currentSentence.words.forEach((_, i) => {
      if (revealedWords.has(i)) return;
      switch (difficulty) {
        case 1:
          if ((i + 1) % 3 === 0) masked.add(i);
          break;
        case 2:
          if (i % 2 === 1) masked.add(i);
          break;
        case 3:
          if (i % 3 !== 0) masked.add(i);
          break;
        case 4:
          masked.add(i);
          break;
      }
    });
    return masked;
  }, [currentSentence.words, difficulty, revealedWords]);

  // Detect segment boundary while recording
  useEffect(() => {
    if (
      isRecording &&
      prevSentenceRef.current &&
      prevSentenceRef.current.index !== currentSentence.index
    ) {
      segmentsInChunkRef.current += 1;
      const uri = getRecorderUri();

      setRevealedWords(new Set());
      if (uri) {
        onSegmentComplete(prevSentenceRef.current, uri);
      }
    }
    prevSentenceRef.current = currentSentence;
  }, [currentSentence.index, isRecording]);

  // Stop recording 1 second before the last segment ends
  const chunkStoppingRef = useRef(false);
  useEffect(() => {
    if (!isRecording || !currentVideo || chunkStoppingRef.current) return;
    const chunkEndIdx = Math.min(
      chunkStartIndexRef.current + chunkSize - 1,
      currentVideo.sentences.length - 1,
    );
    const lastSegment = currentVideo.sentences[chunkEndIdx];
    if (!lastSegment) return;
    const stopTime = lastSegment.end - 1;
    if (currentSentence.index === chunkEndIdx && time >= stopTime) {
      chunkStoppingRef.current = true;
      pausePlayer();
      const pausedAt = time;
      const startedAt = Date.now();
      const interval = setInterval(() => {
        setSimulatedTime(pausedAt + (Date.now() - startedAt) / 1000);
      }, 500);
      setTimeout(async () => {
        clearInterval(interval);
        setSimulatedTime(null);
        const uri = getRecorderUri();
        if (uri) {
          endSession(currentSentence, uri);
        }
        setIsAnalyzing(true);
        await stopRecording();
        pausePlayer();
        setPlayerSpeed(1);
        unMutePlayer();
        setShowChunkResults(true);
      }, 2000);
    }
  }, [time, isRecording, currentVideo, currentSentence]);

  // Turn off analyzing spinner once all results are done processing
  useEffect(() => {
    if (
      isAnalyzing &&
      results.length > 0 &&
      results.every((r) => r.status !== "processing")
    ) {
      setIsAnalyzing(false);
    }
  }, [results, isAnalyzing]);

  // Reset revealed words on segment change (each segment has different words)
  // Only reset difficulty when navigating outside the chunk
  useEffect(() => {
    if (isRecording) return;
    setRevealedWords(new Set());
    if (
      chunkSelected &&
      currentSentence.index >= chunkRange.start &&
      currentSentence.index <= chunkRange.end
    ) {
      return;
    }
    clearResults();
    setDifficulty(0);
  }, [currentSentence.index]);

  // Mark as listened when playback starts then stops after chunk selection
  const playbackStartedRef = useRef(false);
  useEffect(() => {
    if (!chunkSelected || hasListened) return;
    if (playerIsPlaying) {
      playbackStartedRef.current = true;
    } else if (playbackStartedRef.current && !isRecording) {
      setHasListened(true);
      playbackStartedRef.current = false;
    }
  }, [playerIsPlaying, chunkSelected, hasListened, isRecording]);

  const getChunkEndTime = useCallback(() => {
    if (!currentVideo || !chunkSelected) return undefined;
    return currentVideo.sentences[chunkRange.end]?.end;
  }, [currentVideo, chunkSelected, chunkRange.end]);

  const getChunkStartTime = useCallback(() => {
    if (!currentVideo || !chunkSelected) return undefined;
    return currentVideo.sentences[chunkRange.start]?.start;
  }, [currentVideo, chunkSelected, chunkRange.start]);

  const replayChunk = useCallback(
    (speed: number) => {
      unMutePlayer();
      setPlayerSpeed(speed);
      setClipEnd(getChunkEndTime());
      const startTime = getChunkStartTime();
      if (startTime !== undefined) {
        onPlayClip(startTime);
      } else {
        playSentence();
      }
    },
    [
      playSentence,
      setPlayerSpeed,
      unMutePlayer,
      setClipEnd,
      getChunkEndTime,
      getChunkStartTime,
      onPlayClip,
      resumePlayer,
    ],
  );

  const handleReplay = useCallback(() => replayChunk(1), [replayChunk]);
  const handleReplaySlow = useCallback(() => replayChunk(0.8), [replayChunk]);

  const handlePlayPause = useCallback(() => {
    if (playerIsPlaying) {
      pausePlayer();
    } else {
      unMutePlayer();
      setPlayerSpeed(1);
      resumePlayer();
    }
  }, [
    playerIsPlaying,
    pausePlayer,
    resumePlayer,
    unMutePlayer,
    setPlayerSpeed,
  ]);

  const handleRecord = useCallback(async () => {
    setPlayerSpeed(playbackSpeed);
    segmentsInChunkRef.current = 0;
    chunkStartIndexRef.current = chunkRange.start;
    chunkStoppingRef.current = false;
    setShowChunkResults(false);
    setIsAnalyzing(false);

    mutePlayer();

    // Seek to chunk start before recording
    const startSentence = currentVideo?.sentences[chunkRange.start];
    if (startSentence) {
      onPlayClip(startSentence.start);
    }

    startSession();
    await startRecording();
    prevSentenceRef.current = currentSentence;
    setClipEnd(getChunkEndTime());
  }, [
    startRecording,
    startSession,
    currentSentence,
    currentVideo,
    mutePlayer,
    setPlayerSpeed,
    playbackSpeed,
    onPlayClip,
    chunkRange.start,
    setClipEnd,
    getChunkEndTime,
  ]);

  const handleStop = useCallback(async () => {
    const uri = getRecorderUri();
    if (uri) {
      endSession(currentSentence, uri);
    }
    await stopRecording();
    pausePlayer();
    setPlayerSpeed(1);
    unMutePlayer();
    setShowChunkResults(true);
  }, [
    stopRecording,
    pausePlayer,
    endSession,
    currentSentence,
    getRecorderUri,
    setPlayerSpeed,
    unMutePlayer,
  ]);

  const handleRetry = useCallback(() => {
    setShowChunkResults(false);
    setIsAnalyzing(false);
    chunkStoppingRef.current = false;
    clearResults();
    setRevealedWords(new Set());
    if (currentVideo) {
      const startSentence = currentVideo.sentences[chunkStartIndexRef.current];
      if (startSentence) {
        onPlayClip(startSentence.start);
      }
    }
  }, [currentVideo, onPlayClip, clearResults]);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  return (
    <View style={styles.container}>
      {chunkSelected ? (
        <NavSwitcher
          onPrev={handleChunkPrev}
          onNext={handleChunkNext}
          currentIndex={currentSentenceIndex - chunkRange.start}
          totalItems={chunkRange.end - chunkRange.start + 1}
          sentences={currentVideo.sentences}
          onPlayClip={onPlayClip}
          videoId={currentVideo.videoId}
          hasSearch={false}
        >
          <Text style={styles.segmentNavText}>
            Selected Segments {chunkRange.start + 1}-{chunkRange.end + 1}
          </Text>
          <TouchableOpacity
            onPress={handleDeselectChunk}
            style={styles.deselectButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="close" size={18} color="#888" />
          </TouchableOpacity>
        </NavSwitcher>
      ) : (
        <NavSwitcher
          onPrev={handlePreviousSentence}
          onNext={handleNextSentence}
          currentIndex={currentSentenceIndex}
          totalItems={currentVideo.sentences.length}
          sentences={currentVideo.sentences}
          onPlayClip={onPlayClip}
          videoId={currentVideo.videoId}
        >
          <Text style={styles.segmentNavText}>
            Segment {currentSentenceIndex + 1} of{" "}
            {currentVideo.sentences.length}
          </Text>
        </NavSwitcher>
      )}

      {!chunkSelected ? (
        <View style={styles.selectChunkContainer}>
          <View style={styles.chunkSizeRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.chunkSizeOption,
                  chunkSize === n && styles.chunkSizeOptionActive,
                ]}
                onPress={() => setChunkSize(n)}
              >
                <Text
                  style={[
                    styles.chunkSizeText,
                    chunkSize === n && styles.chunkSizeTextActive,
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.selectChunkButton}
            onPress={handleSelectChunk}
          >
            <Text style={styles.selectChunkButtonText}>
              Select the next {chunkSize} segment{chunkSize > 1 ? "s" : ""} to
              memorize
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {!isAnalyzing &&
            !showChunkResults &&
            !selectedResult &&
            !isRecording && (
              <View style={styles.controlsContainer}>
                <PlayerControls
                  onReplay={handleReplay}
                  onReplaySlow={handleReplaySlow}
                  onPlayPause={handlePlayPause}
                  isPlaying={playerIsPlaying}
                />
                <TouchableOpacity onPress={() => setIsSettingsVisible(true)}>
                  <Feather name="settings" size={30} color="#222222" />
                </TouchableOpacity>
              </View>
            )}
          {selectedResult?.accuracyResult ? (
            <ScrollView style={styles.transcriptContainer}>
              <ShadowResults
                accuracyResult={selectedResult.accuracyResult}
                handleNextSentence={() => {}}
                handleRetry={() => setSelectedResult(null)}
                properNouns={orderedCharacters}
              />
            </ScrollView>
          ) : isAnalyzing || showChunkResults ? (
            <ScrollView
              style={styles.transcriptContainer}
              contentContainerStyle={styles.chunkResultsContent}
            >
              {isAnalyzing ? (
                <View style={styles.analyzingContainer}>
                  <ActivityIndicator size="large" color="#3d3a52" />
                  <Text style={styles.analyzingText}>Analyzing...</Text>
                </View>
              ) : (
                <>
                  {(() => {
                    const completedResults = results.filter(
                      (r) => r.status === "complete",
                    );
                    const totalPercentage =
                      completedResults.length > 0
                        ? Math.round(
                            completedResults.reduce(
                              (sum, r) => sum + r.percentage,
                              0,
                            ) / completedResults.length,
                          )
                        : 0;
                    return <AccuracyCircle percentage={totalPercentage} />;
                  })()}

                  <View
                    style={[
                      styles.resultsList,
                      { alignSelf: "stretch", marginHorizontal: 0 },
                    ]}
                  >
                    {results.map((result) => (
                      <TouchableOpacity
                        key={result.segmentIndex}
                        style={styles.resultRow}
                        onPress={() =>
                          result.status === "complete"
                            ? setSelectedResult(result)
                            : null
                        }
                        disabled={result.status !== "complete"}
                      >
                        <Text style={styles.resultSegmentLabel}>
                          Seg {result.segmentIndex + 1}
                        </Text>
                        {result.status === "error" ? (
                          <Text style={styles.resultError}>Error</Text>
                        ) : (
                          <Text
                            style={[
                              styles.resultPercentage,
                              { color: getScoreColor(result.percentage) },
                            ]}
                          >
                            {result.percentage}%
                          </Text>
                        )}
                        <Text style={styles.resultText} numberOfLines={1}>
                          {result.segmentText}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.chunkActionButtons}>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={handleRetry}
                    >
                      <MaterialIcons name="replay" size={20} color="#3d3a52" />
                      <Text style={styles.retryButtonText}>Re-Try</Text>
                    </TouchableOpacity>
                    {difficulty < 4 && (
                      <TouchableOpacity
                        style={styles.lessHintsButton}
                        onPress={() => {
                          setDifficulty((d) => Math.min(d + 1, 4));
                          setRevealedWords(new Set());
                          handleRetry();
                        }}
                      >
                        <MaterialIcons
                          name="visibility-off"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.lessHintsButtonText}>
                          Less hints
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          ) : (
            <>
              <ScrollView style={styles.transcriptContainer}>
                <FullSegmentTranscriptBubble
                  words={currentSentence.words || []}
                  blurredIndices={maskedIndices}
                  time={simulatedTime ?? time}
                  playerIsPlaying={playerIsPlaying || simulatedTime !== null}
                  showFullText
                  onWordPress={(index) => {
                    setRevealedWords((prev) => {
                      const next = new Set(prev);
                      next.add(index);
                      return next;
                    });
                  }}
                />

                <DifficultySlider
                  difficulty={difficulty}
                  onDifficultyChange={(d) => {
                    setDifficulty(d);
                    setRevealedWords(new Set());
                  }}
                />

                {results.length > 0 && (
                  <View style={styles.resultsList}>
                    {[...results].reverse().map((result) => (
                      <TouchableOpacity
                        key={result.segmentIndex}
                        style={styles.resultRow}
                        onPress={() =>
                          result.status === "complete"
                            ? setSelectedResult(result)
                            : null
                        }
                        disabled={result.status !== "complete"}
                      >
                        <Text style={styles.resultSegmentLabel}>
                          Seg {result.segmentIndex + 1}
                        </Text>
                        {result.status === "processing" ? (
                          <ActivityIndicator size="small" color="#888" />
                        ) : result.status === "error" ? (
                          <Text style={styles.resultError}>Error</Text>
                        ) : (
                          <Text
                            style={[
                              styles.resultPercentage,
                              { color: getScoreColor(result.percentage) },
                            ]}
                          >
                            {result.percentage}%
                          </Text>
                        )}
                        <Text style={styles.resultText} numberOfLines={1}>
                          {result.segmentText}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>

              {playerIsPlaying && !isRecording && (
                <Text style={styles.listenFirstText}>
                  {!hasListened
                    ? "Listen First..."
                    : "Pause Video When Ready to Record..."}
                </Text>
              )}
              <RecordingControls
                isRecording={isRecording}
                hasRecordings={isRecording}
                disabled={playerIsPlaying}
                onTrash={() => {
                  if (isRecording) {
                    stopRecording();
                    pausePlayer();
                    setPlayerSpeed(1);
                    unMutePlayer();
                  }
                  clearResults();
                  setRevealedWords(new Set());
                  setShowChunkResults(false);
                  setIsAnalyzing(false);
                  chunkStoppingRef.current = false;
                }}
                onMic={() => {
                  if (isRecording) {
                    // pause - broken for now
                  } else {
                    handleRecord();
                  }
                }}
                onSubmit={() => {
                  if (isRecording) {
                    handleStop();
                  }
                }}
              />
            </>
          )}
        </>
      )}
      {isSettingsVisible && (
        <SettingsModal
          visible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          playbackSpeed={playbackSpeed}
          recordSpeed={playbackSpeed}
          setPlaybackSpeed={(speed) => {
            setPlaybackSpeed(speed);
            setPlayerSpeed(speed);
          }}
          setRecordSpeed={() => {}}
          initMute={false}
          setMuteWhenRecording={() => {}}
          onSave={() => {}}
          speedOptions={[0.25, 0.4, 0.6, 0.75, 1]}
          hideToggles
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  segmentNavText: {
    opacity: 0.6,
  },
  transcriptContainer: {
    flex: 1,
  },
  resultsList: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
  },
  resultSegmentLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    width: 44,
  },
  resultPercentage: {
    fontSize: 16,
    fontWeight: "700",
    width: 48,
  },
  resultError: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
    width: 44,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    color: "#888",
  },
  chunkResultsContent: {
    alignItems: "center" as const,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  analyzingContainer: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 48,
    gap: 16,
  },
  analyzingText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500" as const,
  },
  retryButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#3d3a52",
    borderRadius: 24,
    gap: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: "#3d3a52",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  chunkActionButtons: {
    flexDirection: "row" as const,
    gap: 12,
    marginTop: 24,
  },
  lessHintsButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#3d3a52",
    borderRadius: 24,
    gap: 8,
  },
  lessHintsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  listenFirstText: {
    textAlign: "center" as const,
    fontSize: 15,
    fontWeight: "500" as const,
    color: "#888",
    marginBottom: 8,
  },
  deselectButton: {
    marginLeft: 8,
    padding: 2,
  },
  selectChunkContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 32,
    gap: 24,
  },
  chunkSizeRow: {
    flexDirection: "row" as const,
    gap: 12,
  },
  chunkSizeOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0f0f0",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  chunkSizeOptionActive: {
    backgroundColor: "#3d3a52",
  },
  chunkSizeText: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#666",
  },
  chunkSizeTextActive: {
    color: "#fff",
  },
  selectChunkButton: {
    backgroundColor: "#3d3a52",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  selectChunkButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },
});

export default SpeedRunTab;
