import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { RootState, Segment, Video } from "../../types";
import { supabase } from "../../../lib/supabase";
import {
  setCurrentSearchResults,
  setCurrentSearchTerm,
} from "../../store/actions/dataActions";

const WordSearch: React.FC = () => {
  const currentSearchTerm = useSelector(
    (state: RootState) => state.currentSearchTerm,
  );
  const dispatch = useDispatch();

  const handleSearch = async () => {
    const { data, error } = await supabase
      .from("transcript_segment")
      .select("*")
      .ilike("text", `%${currentSearchTerm}%`);

    if (error) {
      console.error(error);
    } else {
      dispatch(setCurrentSearchResults(data as Segment[]));
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Find video with specific words or phrases..."
        style={styles.input}
        value={currentSearchTerm}
        onChangeText={(text) => dispatch(setCurrentSearchTerm(text))}
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
