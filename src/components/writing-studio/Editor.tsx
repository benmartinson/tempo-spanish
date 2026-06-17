import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SegmentWord } from "../../types";
import { normalizeWord, removeSpecialPunctuation } from "../../helpers/helpers";

interface EditorProps {
  words: SegmentWord[];
  onWordsComplete: (completed: number[], allComplete: boolean) => void;
}

const Editor: React.FC<EditorProps> = ({ words, onWordsComplete }) => {
  const [text, setText] = useState("");

  const checkCompletions = (textToCheck: string) => {
    console.log({ words, textToCheck });
    const writtenWords = textToCheck.split(" ");
    const newCompletions: number[] = [];
    let allWordsComplete = true;
    words.forEach((word, index) => {
      if (index >= writtenWords.length) {
        allWordsComplete = false;
        return;
      }
      const wordToCheck = writtenWords[index];
      console.log({ wordToCheck });
      const normalWordToCheck = normalizeWord(
        removeSpecialPunctuation(wordToCheck),
      );
      const normalWord = normalizeWord(removeSpecialPunctuation(word.word));
      if (normalWord === normalWordToCheck) {
        newCompletions.push(index);
      } else {
        allWordsComplete = false;
      }
    });

    if (newCompletions.length !== 0) {
      onWordsComplete(newCompletions, allWordsComplete);
    }
  };

  const handleChange = (newText: string) => {
    const lastChar = newText[newText.length - 1];
    if (lastChar === " ") {
      checkCompletions(newText);
    }
    setText(newText);
  };

  return (
    <View style={styles.container}>
      <textarea value={text} onChange={(e) => handleChange(e.target.value)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});

export default Editor;
