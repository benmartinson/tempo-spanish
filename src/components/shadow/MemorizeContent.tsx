import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StyleSheet, ScrollView, View, Pressable, Text } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import { RootState, Sentence, SegmentWord, VocabCacheEntry } from "../../types";
import FullSegmentTranscriptBubble from "../common/FullSegmentTranscriptBubble";
import DifficultySlider from "../common/DifficultySlider";
import DraggableWebPanel from "../common/DraggableWebPanel";
import TranslateContent from "./TranslateContent";
import { setMemorizeDifficulty } from "../../store/actions/dataActions";
import { persistMemorizeDifficulty } from "../../requests";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import {
  computeBaseMaskedIndices,
  getAutoHintDifficulty,
} from "../../helpers/helpers";

interface MemorizeContentProps {
  time: number;
  playKey?: number;
  playerSpeed?: number;
  currentSentence: Sentence;
  playerIsPlaying: boolean;
  isRecording?: boolean;
  localDifficulty: number;
  onLocalDifficultyChange: (d: number) => void;
  playWordSnippet?: (word: SegmentWord, isSlow?: boolean) => void;
  vocabCache?: VocabCacheEntry[];
  onVocabCacheUpdate?: (entry: VocabCacheEntry) => void;
  layout?: "default" | "webPlayer";
  webPlayerControls?: ReactNode;
  webRecordingControls?: ReactNode;
  webSentenceNav?: ReactNode;
  webStatusContent?: ReactNode;
  webPlayRecordingButton?: ReactNode;
  translationText?: string | null;
  isLoadingTranslation?: boolean;
}

const MemorizeContent: React.FC<MemorizeContentProps> = ({
  time,
  playKey,
  playerSpeed,
  currentSentence,
  playerIsPlaying,
  isRecording = false,
  localDifficulty,
  onLocalDifficultyChange,
  playWordSnippet,
  vocabCache,
  onVocabCacheUpdate,
  layout = "default",
  webPlayerControls,
  webRecordingControls,
  webSentenceNav,
  webStatusContent,
  webPlayRecordingButton,
  translationText = null,
  isLoadingTranslation = false,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const savedDifficulty = useSelector(
    (state: RootState) => state.memorizeDifficulty,
  );
  const [manualOverride, setManualOverride] = useState<number | null>(null);

  const baseDifficulty = userSettings.autoSelectDifficulty
    ? getAutoHintDifficulty(
        currentSentence.text?.length ?? 0,
        userSettings.autoSelectDifficultyLevel,
      )
    : userSettings.saveMemorizeDifficulty
      ? savedDifficulty
      : localDifficulty;

  const difficulty = manualOverride ?? baseDifficulty;

  const setDifficulty = useCallback(
    (d: number) => {
      if (userSettings.autoSelectDifficulty) {
        setManualOverride(d);
      } else if (userSettings.saveMemorizeDifficulty) {
        dispatch(setMemorizeDifficulty(d));
        persistMemorizeDifficulty({
          supabase,
          userId: userId ?? null,
          memorizeDifficulty: d,
        });
      } else {
        onLocalDifficultyChange(d);
      }
    },
    [
      dispatch,
      supabase,
      userId,
      userSettings.saveMemorizeDifficulty,
      userSettings.autoSelectDifficulty,
      onLocalDifficultyChange,
    ],
  );
  const [revealedWords, setRevealedWords] = useState<Set<number>>(new Set());
  const [hintLevels, setHintLevels] = useState<Record<number, number>>({});
  const [translationRevealed, setTranslationRevealed] = useState(false);

  // Compute which words would be masked (ignoring reveals) — stable per difficulty/segment
  const baseMaskedIndices = useMemo(
    () => computeBaseMaskedIndices(currentSentence.words, difficulty),
    [currentSentence.words, difficulty],
  );

  // Subtract revealed words — doesn't shift which other words are masked
  const maskedIndices = useMemo(() => {
    if (revealedWords.size === 0) return baseMaskedIndices;
    const masked = new Set(baseMaskedIndices);
    revealedWords.forEach((i) => masked.delete(i));
    return masked;
  }, [baseMaskedIndices, revealedWords]);

  // How many characters to reveal per hint level
  const revealCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const [indexStr, level] of Object.entries(hintLevels)) {
      const index = Number(indexStr);
      if (level === 1) counts[index] = 1;
    }
    return counts;
  }, [hintLevels, currentSentence.index, difficulty]);

  // Reset revealed words and manual override on segment change or recording toggle
  useEffect(() => {
    setRevealedWords(new Set());
    setHintLevels({});
    setManualOverride(null);
    setTranslationRevealed(false);
  }, [currentSentence.index]);

  useEffect(() => {
    setRevealedWords(new Set());
    setHintLevels({});
  }, [isRecording]);

  const transcriptBubble = (
    <FullSegmentTranscriptBubble
      words={currentSentence.words || []}
      blurredIndices={maskedIndices}
      time={time}
      playKey={playKey}
      playerSpeed={playerSpeed}
      playerIsPlaying={playerIsPlaying}
      showFullText
      disableGuessModal={isRecording}
      playWordSnippet={playWordSnippet}
      revealCounts={revealCounts}
      vocabCache={vocabCache}
      onVocabCacheUpdate={onVocabCacheUpdate}
      attachedTop={layout === "webPlayer"}
      squareEdges={layout === "webPlayer"}
      onWordPress={(index) => {
        if (isRecording) {
          // During recording: progressive hint reveal
          const currentLevel = hintLevels[index] ?? 0;
          const wordText = currentSentence.words?.[index]?.word?.trim() ?? "";
          const skipHint = /^\d/.test(wordText) || wordText.length <= 1;
          if (currentLevel === 0 && !skipHint) {
            setHintLevels((prev) => ({ ...prev, [index]: 1 }));
          } else {
            setRevealedWords((prev) => {
              const next = new Set(prev);
              next.add(index);
              return next;
            });
          }
        } else {
          setRevealedWords((prev) => {
            const next = new Set(prev);
            next.add(index);
            return next;
          });
        }
      }}
    />
  );

  const difficultySlider = (
    <DifficultySlider
      difficulty={difficulty}
      onDifficultyChange={(d) => {
        setDifficulty(d);
        setRevealedWords(new Set());
      }}
      variant={layout === "webPlayer" ? "compact" : "default"}
    />
  );

  const shouldShowTranslationSection =
    isLoadingTranslation || !!translationText;
  const webTranslationSection =
    layout === "webPlayer" && shouldShowTranslationSection ? (
      <View style={styles.webTranslationContainer}>
        {!translationRevealed ? (
          <Pressable
            style={[
              styles.webTranslationDisclosure,
              styles.webTranslationDisclosureCollapsed,
            ]}
            onPress={() => setTranslationRevealed(true)}
          >
            <View style={styles.webTranslationDisclosureAction}>
              <Text style={styles.webTranslationDisclosureText}>
                translation
              </Text>
              <MaterialIcons name="visibility" size={18} color="gray" />
            </View>
          </Pressable>
        ) : (
          <View style={styles.webTranslationContent}>
            <TranslateContent
              translationText={translationText}
              sentenceText={currentSentence.text}
              isLoading={isLoadingTranslation}
              time={time}
              playerIsPlaying={playerIsPlaying}
              segmentStart={currentSentence.start}
              segmentEnd={currentSentence.end}
              playKey={playKey}
              isRecording={isRecording}
              playerSpeed={playerSpeed}
              variant="webPanel"
            />
            <Pressable
              style={styles.webTranslationCollapseButton}
              onPress={() => setTranslationRevealed(false)}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            >
              <MaterialIcons
                name="keyboard-arrow-up"
                size={20}
                color="#647089"
              />
            </Pressable>
          </View>
        )}
      </View>
    ) : null;

  if (layout === "webPlayer") {
    return (
      <View style={styles.webContainer}>
        <DraggableWebPanel
          initialTop={380}
          width={620}
          dragHandle={
            <View style={styles.webPanelDragHandle}>
              <View style={styles.webPanelDragRail} />
            </View>
          }
        >
          <View style={styles.webPanelShell}>
            {webSentenceNav && (
              <View style={styles.webPanelSentenceNav}>{webSentenceNav}</View>
            )}
            {webStatusContent && (
              <View style={styles.webPanelStatusContent}>
                {webStatusContent}
                {webPlayRecordingButton}
              </View>
            )}
            {!webStatusContent && (
              <>
                <View style={styles.webPanelHeader}>
                  <View style={styles.webPanelHeaderLeft}>
                    {webPlayerControls}
                  </View>
                  <View style={styles.webPanelHeaderRight}>
                    {webRecordingControls}
                  </View>
                </View>
                {transcriptBubble}
                <View style={styles.webPanelDifficultyRow}>
                  <View style={styles.webPanelAccent} />
                  <View style={styles.webPanelDifficulty}>
                    {difficultySlider}
                  </View>
                </View>
                <View style={styles.webTranscriptBody}>
                  {webTranslationSection}
                </View>
              </>
            )}
          </View>
        </DraggableWebPanel>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {transcriptBubble}
      {difficultySlider}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webContainer: {
    flex: 1,
    width: "100%",
  },
  webPanelDragHandle: {
    marginHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: "#f7f9ff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(74, 105, 189, 0.22)",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  webPanelDragRail: {
    width: 54,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(74, 105, 189, 0.34)",
  },
  webPanelShell: {
    position: "relative",
    marginHorizontal: 16,
    backgroundColor: "#eef4ff",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.22)",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
  },
  webPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#f7f9ff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.2)",
  },
  webPanelSentenceNav: {
    width: "100%",
  },
  webPanelHeaderLeft: {
    flex: 1,
    alignItems: "flex-start",
    minWidth: 0,
  },
  webPanelHeaderRight: {
    flex: 1,
    alignItems: "flex-end",
    minWidth: 0,
  },
  webPanelDifficultyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  webPanelAccent: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: "#4ade80",
  },
  webPanelDifficulty: {
    flex: 1,
    minWidth: 0,
  },
  webTranscriptBody: {
    backgroundColor: "#f0f4ff",
    paddingBottom: 14,
  },
  webTranslationContainer: {
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.16)",
    backgroundColor: "#f0f4ff",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
    overflow: "hidden",
  },
  webTranslationDisclosure: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  webTranslationDisclosureAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    opacity: 0.5,
  },
  webTranslationDisclosureCollapsed: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
  webTranslationDisclosureText: {
    color: "#647089",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  webTranslationContent: {
    minHeight: 64,
  },
  webTranslationCollapseButton: {
    alignSelf: "center",
    width: 30,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -2,
    marginBottom: 6,
    backgroundColor: "rgba(255, 255, 255, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
  },
  webPanelStatusContent: {
    backgroundColor: "#f0f4ff",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
});

export default MemorizeContent;
