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
import { useRecording } from "../useRecording";
import { useSpeedRunSession, SegmentResult } from "./useSpeedRunSession";
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
  const CHUNK_SIZE = 3;
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
      chunkStartIndexRef.current + CHUNK_SIZE - 1,
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

  // Clear results and revealed words when segment changes outside the current chunk
  useEffect(() => {
    if (!isRecording) {
      const chunkStart = chunkStartIndexRef.current;
      const chunkEnd = chunkStart + CHUNK_SIZE - 1;
      if (
        currentSentence.index < chunkStart ||
        currentSentence.index > chunkEnd
      ) {
        clearResults();
        setRevealedWords(new Set());
        setDifficulty(0);
      }
    }
  }, [currentSentence.index]);

  const getChunkEndTime = useCallback(() => {
    if (!currentVideo) return undefined;
    const currentIdx = currentVideo.currentSentence;
    const endIdx = Math.min(
      currentIdx + CHUNK_SIZE - 1,
      currentVideo.sentences.length - 1,
    );
    return currentVideo.sentences[endIdx]?.end;
  }, [currentVideo]);

  const handleReplay = useCallback(() => {
    unMutePlayer();
    setPlayerSpeed(1);
    setClipEnd(getChunkEndTime());
    playSentence();
  }, [playSentence, setPlayerSpeed, unMutePlayer, setClipEnd, getChunkEndTime]);

  const handleReplaySlow = useCallback(() => {
    unMutePlayer();
    setPlayerSpeed(0.8);
    setClipEnd(getChunkEndTime());
    playSentence();
  }, [playSentence, setPlayerSpeed, unMutePlayer, setClipEnd, getChunkEndTime]);

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
    mutePlayer();
    setPlayerSpeed(playbackSpeed);
    segmentsInChunkRef.current = 0;
    chunkStartIndexRef.current = currentVideo?.currentSentence ?? 0;
    chunkStoppingRef.current = false;
    setShowChunkResults(false);
    setIsAnalyzing(false);

    startSession();
    await startRecording();
    prevSentenceRef.current = currentSentence;
    setClipEnd(getChunkEndTime());
    playSentence();
  }, [
    startRecording,
    startSession,
    currentSentence,
    mutePlayer,
    setPlayerSpeed,
    playbackSpeed,
    playSentence,
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
    setShowChunkResults(true);
  }, [stopRecording, pausePlayer, endSession, currentSentence, getRecorderUri]);

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
          {currentVideo.sentences.length + 1}
        </Text>
      </NavSwitcher>
      {!isAnalyzing && !showChunkResults && !selectedResult && (
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
                    <Text style={styles.lessHintsButtonText}>Less hints</Text>
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

          <RecordingControls
            isRecording={isRecording}
            hasRecordings={isRecording}
            onTrash={() => {
              if (isRecording) {
                stopRecording();
                pausePlayer();
              }
              clearResults();
              setRevealedWords(new Set());
              setShowChunkResults(false);
              handleRetry();
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
});

export default SpeedRunTab;
