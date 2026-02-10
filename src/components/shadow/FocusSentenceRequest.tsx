import { Text, StyleSheet, TouchableOpacity } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../types";
import { addFocusSentence } from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";

interface FocusSentenceRequestProps {
  sentenceIndex: number;
  translation: string;
  sentenceText: string;
  segmentIndex: number;
  videoViewId: number;
}

const FocusSentenceRequest: React.FC<FocusSentenceRequestProps> = ({
  sentenceIndex,
  translation,
  sentenceText,
  segmentIndex,
  videoViewId,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();

  const isMarked = useSelector((state: RootState) =>
    state.currentVideo?.focusSentences?.some(
      (s) =>
        s.segment_index === segmentIndex && s.sentence_index === sentenceIndex,
    ),
  );

  const handlePress = async () => {
    if (isMarked) return;

    // const { data, error } = await supabase
    //   .from("video_view_focus_sentence")
    //   .insert({
    //     video_view_id: videoViewId,
    //     text: sentenceText,
    //     translation: translation,
    //     segment_index: segmentIndex,
    //     sentence_index: sentenceIndex,
    //   })
    //   .select("id, text, translation, segment_index, sentence_index")
    //   .single();

    // if (error) {
    //   console.error(error);
    //   return;
    // }

    // dispatch(
    //   addFocusSentence({
    //     id: data.id,
    //     text: data.text,
    //     translation: data.translation,
    //     segment_index: data.segment_index,
    //     sentence_index: data.sentence_index,
    //   }),
    // );
  };

  return (
    <TouchableOpacity
      style={[styles.container, isMarked && styles.containerMarked]}
      onPress={handlePress}
    >
      <Text style={styles.title}>
        {isMarked
          ? "Sentence Marked for Review."
          : "Mark this Sentence as Difficult"}
      </Text>
      {!isMarked && <Entypo name="pencil" size={24} color="black" />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#3d3a52",
    borderRadius: 16,
    padding: 8,
    margin: 16,
    marginBottom: 0,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
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
