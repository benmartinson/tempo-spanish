import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import moment from "moment";
import SelectVocabPage from "./SelectVocabPage";

interface WordList {
  id: number;
  created_at: string;
}

const GuidedPractice: React.FC = () => {
  const { userId } = useAuth();
  const supabase = useSupabaseWithClerk();
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [showNewList, setShowNewList] = useState(false);

  const fetchWordLists = async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("user_word_list")
      .select("id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching word lists:", error);
    }
    const lists = data ?? [];
    setWordLists(lists);
    if (lists.length === 0) {
      setShowNewList(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWordLists();
  }, [supabase, userId]);

  // Show SelectVocabPage for new list
  if (showNewList) {
    return (
      <SelectVocabPage
        onBack={() => {
          if (wordLists.length > 0) {
            setShowNewList(false);
          }
        }}
        onSaved={() => {
          setShowNewList(false);
          fetchWordLists();
        }}
      />
    );
  }

  // Show SelectVocabPage for existing list
  if (selectedListId !== null) {
    return (
      <SelectVocabPage
        wordListId={selectedListId}
        onBack={() => setSelectedListId(null)}
        onSaved={() => {
          setSelectedListId(null);
          fetchWordLists();
        }}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5a5680" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Word Lists</Text>
      {wordLists.map((list) => (
        <TouchableOpacity
          key={list.id}
          style={styles.listRow}
          onPress={() => setSelectedListId(list.id)}
        >
          <Text style={styles.listDate}>
            {moment(list.created_at).format("MMM D, YYYY")}
          </Text>
          <Text style={styles.listArrow}>›</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={styles.newListButton}
        onPress={() => setShowNewList(true)}
      >
        <Text style={styles.newListButtonText}>+ New Word List</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  content: {
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    marginBottom: 20,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  listDate: {
    fontSize: 16,
    color: "#222",
    fontWeight: "500",
  },
  listArrow: {
    fontSize: 22,
    color: "#999",
  },
  newListButton: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3d3a52",
  },
  newListButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3d3a52",
  },
});

export default GuidedPractice;
