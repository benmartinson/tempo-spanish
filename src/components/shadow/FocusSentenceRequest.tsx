import { Text, StyleSheet, TouchableOpacity } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../types";
import {
  addFocusSentence,
  removeFocusSentence,
} from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useState } from "react";

interface FocusSentenceRequestProps {
  sentenceIndex: number;
  translation: string;
  sentenceText: string;
  segmentIndex: number;
  videoViewId: number;
  markedId: number | null;
}

const FocusSentenceRequest: React.FC<FocusSentenceRequestProps> = ({
  sentenceIndex,
  translation,
  sentenceText,
  segmentIndex,
  videoViewId,
  markedId,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();

  const isMarked = Boolean(markedId);

  const handlePress = async () => {
    if (isMarked) {
      console.log("Removing marked sentence", markedId, videoViewId);
      const { data, error } = await supabase
        .from("video_view_focus_sentence")
        .delete()
        .eq("video_view_id", videoViewId)
        .eq("id", markedId);
      if (error) {
        console.error(error);
        return;
      }

      dispatch(removeFocusSentence(markedId));
      return;
    }

    const { data, error } = await supabase
      .from("video_view_focus_sentence")
      .insert({
        video_view_id: videoViewId,
        text: sentenceText,
        translation: translation,
        segment_index: segmentIndex,
        sentence_index: sentenceIndex,
      })
      .select("id, text, translation, segment_index, sentence_index")
      .single();

    if (error) {
      console.error(error);
      return;
    }

    dispatch(
      addFocusSentence({
        id: data.id,
        text: data.text,
        translation: data.translation,
        segment_index: data.segment_index,
        sentence_index: data.sentence_index,
      }),
    );
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <Entypo name="pencil" size={32} color={isMarked ? "#222222" : "gray"} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shrinkContainer: {
    flex: 1,
    borderColor: "#3d3a52",
    borderRadius: 16,
    width: 40,
    padding: 8,
    margin: 16,
    marginBottom: 0,
  },
  containerMarked: {
    borderColor: "#4caf50",
    backgroundColor: "#e8f5e9",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "black",
  },
  description: {
    fontSize: 14,
    color: "black",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  button: {
    flex: 1,
    backgroundColor: "#3d3a52",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default FocusSentenceRequest;
