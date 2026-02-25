import React from "react";
import { StyleSheet, View, Text } from "react-native";

interface UserAnswerBubbleProps {
  answer: string;
}

const UserAnswerBubble: React.FC<UserAnswerBubbleProps> = ({ answer }) => {
  return (
    <View style={styles.userBubble}>
      <Text style={styles.userBubbleText}>{answer}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  userBubble: {
    backgroundColor: "#4a69bd",
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 14,
    marginBottom: 12,
    alignSelf: "flex-end",
    maxWidth: "80%",
  },
  userBubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#fff",
  },
});

export default UserAnswerBubble;
