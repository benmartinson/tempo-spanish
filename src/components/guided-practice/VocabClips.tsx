import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { RootState, Vocabulary, Segment, Sentence } from "../../types";
import { supabase } from "../../../lib/supabase";
import { useSelector, useDispatch } from "react-redux";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import YouTubePlayer, { YouTubePlayerHandle } from "../common/YouTubePlayer";
import SelectedVideoBanner from "../common/SelectedVideoBanner";
import PlayerControls from "../shadow/PlayerControls";
import { capitalize } from "../../helpers";
import { fetchVideoContext } from "../../requests";
import {
  addUserVideoView,
  setCurrentVideo,
  setCurrentTab,
} from "../../store/actions/dataActions";

interface VocabClipsProps {
  vocabList: Vocabulary[];
  onBack?: () => void;
}

type ClipResult = Segment & {
  youtube_video_id: string;
  video_title: string;
  video_record_id: string;
};

const VocabClips: React.FC<VocabClipsProps> = ({ vocabList, onBack }) => {
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const dispatch = useDispatch();
  const authSupabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const targetLanguage = useSelector(
    (state: RootState) => state.userSettings.targetLanguage,
  );
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ClipResult[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [time, setTime] = useState(0);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [playerSpeed, setPlayerSpeed] = useState(1);
  const [guessedIds, setGuessedIds] = useState<
    Record<number, "correct" | "incorrect">
  >({});

  const currentWord =
    currentWordIndex < vocabList.length ? vocabList[currentWordIndex] : null;

  useEffect(() => {
    if (!currentWord) return;

    const searchForWord = async () => {
      setLoading(true);
      const word = currentWord.word;

      const { data, error } = await supabase
        .from("transcript_segment")
        .select(
          "*, video:video_id(id, video_id, title, channel_id, channel:channel_id(language))",
        )
        .ilike("text", `%${word}%`);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const segments = ((data as any[]) ?? [])
        .filter((row) => row.video?.channel?.language === targetLanguage)
        .map((row) => ({
          ...row,
          youtube_video_id: row.video?.video_id,
          video_title: row.video?.title,
          video_record_id: row.video?.id,
        }));
      setResults(segments);
      console.log({ segments });
      setCurrentClipIndex(0);
      setGuessedIds({});
      setLoading(false);
    };

    searchForWord();
  }, [currentWordIndex, targetLanguage]);

  const handleGuess = (vocab: Vocabulary) => {
    if (guessedIds[vocab.id]) return;

    if (vocab.id === currentWord?.id) {
      setGuessedIds((prev) => ({ ...prev, [vocab.id]: "correct" }));
      setTimeout(() => {
        if (currentWordIndex < vocabList.length - 1) {
          setCurrentWordIndex((i) => i + 1);
          setRefreshKey((k) => k + 1);
        }
      }, 2000);
    } else {
      setGuessedIds((prev) => ({ ...prev, [vocab.id]: "incorrect" }));
    }
  };

  const handleReplay = () => {
    setPlayerSpeed(1);
    setRefreshKey((k) => k + 1);
  };

  const handleReplaySlow = () => {
    setPlayerSpeed(0.8);
    setRefreshKey((k) => k + 1);
  };

  const handlePlayPause = () => {
    if (playerIsPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
  };

  const handleGoToVideo = async () => {
    if (!currentClip || !authSupabase) return;
    try {
      const { videoContext, videoView } = await fetchVideoContext({
        supabase: authSupabase,
        videoId: currentClip.youtube_video_id,
        recordId: currentClip.video_record_id,
        clip: currentClip.start,
      });
      dispatch(addUserVideoView(videoView));
      dispatch(setCurrentVideo(videoContext));
      dispatch(setCurrentTab("shadow"));

      if (userId) {
        await authSupabase.from("user_ui_state").upsert(
          {
            user_id: userId,
            current_video: currentClip.video_record_id,
            current_sentence: videoContext.currentSentence,
            updated_at: new Date(),
          },
          { onConflict: "user_id" },
        );
      }
    } catch (error) {
      console.error("Error navigating to video:", error);
    }
  };

  const currentClip = results.length > 0 ? results[currentClipIndex] : null;

  const currentSentence: Sentence | null = currentClip
    ? {
        index: 0,
        start: currentClip.start,
        end: currentClip.end,
        text: currentClip.text,
        words: currentClip.words || [],
      }
    : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5a5680" />
      </View>
    );
  }

  if (!currentClip) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.noResultsText}>
          No clips found for "{currentWord?.word}"
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SelectedVideoBanner
        title={currentClip.video_title}
        onPress={handleGoToVideo}
        onBack={onBack}
      />
      <View style={styles.playerContainer}>
        <YouTubePlayer
          ref={playerRef}
          videoId={currentClip.youtube_video_id}
          clip={currentSentence}
          autoplay={true}
          refreshKey={refreshKey}
          setTime={setTime}
          muted={false}
          playbackSpeed={playerSpeed}
          startTime={currentClip.start}
          onPlayingStateChange={setPlayerIsPlaying}
        />
      </View>
      <View style={styles.controlsContainer}>
        <PlayerControls
          onReplay={handleReplay}
          onReplaySlow={handleReplaySlow}
          onPlayPause={handlePlayPause}
          isPlaying={playerIsPlaying}
        />
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.questionText}>
          Which vocab word is spoken in this clip?
        </Text>
        <View style={styles.buttonGrid}>
          {vocabList.map((vocab) => {
            const status = guessedIds[vocab.id];
            return (
              <TouchableOpacity
                key={vocab.id}
                style={[
                  styles.wordButton,
                  status === "correct" && styles.wordButtonCorrect,
                  status === "incorrect" && styles.wordButtonIncorrect,
                ]}
                onPress={() => handleGuess(vocab)}
                disabled={!!status}
              >
                <Text
                  style={[
                    styles.wordButtonText,
                    status && styles.wordButtonTextAnswered,
                  ]}
                >
                  {capitalize(vocab.word)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  loadingText: {
    marginTop: 16,
    color: "#666",
    fontSize: 14,
  },
  noResultsText: {
    color: "#666",
    fontSize: 16,
  },
  playerContainer: {
    height: 240,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 16,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
    textAlign: "center",
    marginBottom: 20,
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  wordButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "black",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    minWidth: "45%",
    alignItems: "center",
  },
  wordButtonCorrect: {
    borderColor: "#2d8a4e",
  },
  wordButtonIncorrect: {
    borderColor: "#c0392b",
  },
  wordButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "600",
  },
  wordButtonTextAnswered: {
    opacity: 0.9,
  },
});

export default VocabClips;
