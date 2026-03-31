import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { RootState, Segment, Video } from "../../types";
import { supabase } from "../../../lib/supabase";
import {
  setCurrentSearchResults,
  setCurrentSearchTerm,
  setIsSearching,
  setHasSearched,
} from "../../store/actions/dataActions";
import { stripDiacritics } from "../../helpers/helpers";

const WordSearch: React.FC = () => {
  const currentSearchTerm = useSelector(
    (state: RootState) => state.currentSearchTerm,
  );
  const dispatch = useDispatch();

  const handleSearch = async () => {
    if (!currentSearchTerm?.trim()) return;
    dispatch(setIsSearching(true));
    const normalizedTerm = stripDiacritics(currentSearchTerm.toLowerCase());
    const { data, error } = await supabase
      .from("transcript_segment")
      .select("*");

    if (error) {
      console.error(error);
    } else {
      const filtered = (data as Segment[]).filter((segment) =>
        stripDiacritics(segment.text.toLowerCase()).includes(normalizedTerm),
      );
      dispatch(setCurrentSearchResults(filtered));
    }
    dispatch(setIsSearching(false));
    dispatch(setHasSearched(true));
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Find video with specific word or phrase..."
        style={styles.input}
        value={currentSearchTerm}
        onChangeText={(text) => dispatch(setCurrentSearchTerm(text))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        onSubmitEditing={handleSearch}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "gray",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "black",
  },
});
export default WordSearch;
