import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { setCurrentVideo } from "../../store/actions/dataActions";
import { useDispatch } from "react-redux";

interface SelectVideoPromptProps {
  title?: string;
  subtitle?: string;
}

const SelectVideoPrompt: React.FC<SelectVideoPromptProps> = ({
  title = "No Video Selected",
  subtitle = "Choose a video to start watching",
}) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const handleSelectVideo = () => {
    dispatch(setCurrentVideo(null));
  };

  return (
    <View style={styles.container}>
      <Feather name="film" size={64} color="#5a5680" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <TouchableOpacity style={styles.selectButton} onPress={handleSelectVideo}>
        <Text style={styles.selectButtonText}>Select Video</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 32,
    textAlign: "center",
  },
  selectButton: {
    backgroundColor: "#5a5680",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  selectButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SelectVideoPrompt;
