import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";
import { playAudio } from "../streaming_helpers";
import { useSupabaseWithClerk } from "../../../utils/supabase";

const ELEVENLABS_API_KEY =
  Constants.expoConfig?.extra?.ELEVENLABS_API_KEY ?? "";

interface PlayerControlsProps {
  onReplay?: () => void;
  onReplaySlow?: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  playDisabled?: boolean;
  segmentText?: string;
  videoId?: number;
  sentenceIndex?: number;
}

const generateTTS = async (text: string): Promise<string> => {
  const resp = await fetch(
    "https://api.elevenlabs.io/v1/text-to-speech/jBlmi27XRORxjPquUeCh",
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`ElevenLabs API error ${resp.status}: ${body}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const PlayerControls: React.FC<PlayerControlsProps> = ({
  onReplay,
  onReplaySlow,
  onPlayPause,
  isPlaying,
  playDisabled,
  segmentText,
  videoId,
  sentenceIndex,
}) => {
  const [aiLoading, setAiLoading] = useState(false);
  const supabase = useSupabaseWithClerk();

  const handleAiSpeak = async () => {
    if (!segmentText || aiLoading) return;
    setAiLoading(true);
    try {
      // Check cache first
      if (supabase && videoId != null && sentenceIndex != null) {
        const { data: cached } = await supabase
          .from("sentence_insights")
          .select("segment_recording")
          .eq("video_id", videoId)
          .eq("sentence_index", sentenceIndex)
          .maybeSingle();

        if (cached?.segment_recording) {
          await playAudio(cached.segment_recording);
          return;
        }
      }

      // Generate new TTS
      const base64 = await generateTTS(segmentText);
      await playAudio(base64);

      // Save to cache
      if (supabase && videoId != null && sentenceIndex != null) {
        await supabase.from("sentence_insights").upsert(
          {
            video_id: videoId,
            sentence_index: sentenceIndex,
            segment_recording: base64,
          },
          { onConflict: "video_id,sentence_index" },
        );
      }
    } catch (err) {
      console.error("ElevenLabs TTS error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, styles.buttonLeft]}
        onPress={onReplay}
      >
        <MaterialIcons name="replay" size={24} color="black" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonMiddle]}
        onPress={onReplaySlow}
      >
        <MaterialIcons name="slow-motion-video" size={24} color="black" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.button,
          styles.buttonMiddle,
          playDisabled && { opacity: 0.4 },
        ]}
        onPress={onPlayPause}
        disabled={playDisabled && !isPlaying}
      >
        <MaterialIcons
          name={isPlaying ? "pause" : "play-arrow"}
          size={24}
          color={playDisabled && !isPlaying ? "#ccc" : "black"}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonRight]}
        onPress={handleAiSpeak}
        disabled={!segmentText || aiLoading}
      >
        {aiLoading ? (
          <ActivityIndicator size="small" color="#7C3AED" />
        ) : (
          <MaterialIcons
            name="record-voice-over"
            size={24}
            color={segmentText ? "black" : "#ccc"}
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#3d3a52",
    borderRadius: 24,
  },
  button: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  buttonLeft: {
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  buttonMiddle: {},
  buttonRight: {
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
});

export default PlayerControls;
