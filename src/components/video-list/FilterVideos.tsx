import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
} from "react-native";
import { Channel, ChannelTopic, Topic, Video } from "../../types";
import { Ionicons } from "@expo/vector-icons";
import {
  channelDifficultyMatchesSelection,
  channelDifficultyRank,
  normalizeChannelDifficulty,
} from "../../helpers/channelDifficulty";

const DURATION_FILTERS = [
  { label: "All", min: 0, max: Infinity },
  { label: "< 15 min", min: 0, max: 900 },
  { label: "15–30 min", min: 900, max: 1800 },
  { label: "30+ min", min: 1800, max: Infinity },
];

const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .map((w) =>
      w.length === 0 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");

const FilterVideos: React.FC<{
  videos: Video[];
  mode?: "duration" | "topics";
  topics?: Topic[];
  channelTopics?: ChannelTopic[];
  channels?: Channel[];
  showDifficultyFilter?: boolean;
  children: (props: {
    filteredVideos: Video[];
    filterButton: React.ReactNode;
    activeFilterBar: React.ReactNode;
  }) => React.ReactNode;
}> = ({
  videos,
  mode = "duration",
  topics,
  channelTopics,
  channels,
  showDifficultyFilter = true,
  children,
}) => {
  const [filterVisible, setFilterVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(0);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(
    null,
  );
  const [draftSearchText, setDraftSearchText] = useState("");
  const [draftDuration, setDraftDuration] = useState(0);
  const [draftTopicId, setDraftTopicId] = useState<number | null>(null);
  const [draftDifficulty, setDraftDifficulty] = useState<string | null>(null);

  const availableDifficulties = useMemo(() => {
    if (mode !== "topics" || !channels || !showDifficultyFilter) return [];
    const seen = new Set<string>();
    for (const ch of channels) {
      const normalizedDifficulty = normalizeChannelDifficulty(ch.difficulty);
      if (normalizedDifficulty) seen.add(normalizedDifficulty);
    }
    return Array.from(seen).sort(
      (a, b) => channelDifficultyRank(a) - channelDifficultyRank(b),
    );
  }, [mode, channels, showDifficultyFilter]);

  const channelDifficultyById = useMemo(() => {
    const map = new Map<string, string>();
    if (!channels) return map;
    for (const ch of channels) {
      const normalizedDifficulty = normalizeChannelDifficulty(ch.difficulty);
      if (normalizedDifficulty) map.set(ch.channel_id, normalizedDifficulty);
    }
    return map;
  }, [channels]);

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      if (searchText) {
        const term = searchText.toLowerCase();
        const channelName =
          channels
            ?.find((ch) => ch.channel_id === video.channel_id)
            ?.title?.toLowerCase() ?? "";
        if (
          !video.title.toLowerCase().includes(term) &&
          !channelName.includes(term)
        ) {
          return false;
        }
      }
      if (mode === "topics") {
        if (showDifficultyFilter && selectedDifficulty != null) {
          const chDifficulty = channelDifficultyById.get(video.channel_id);
          if (
            !chDifficulty ||
            !channelDifficultyMatchesSelection(chDifficulty, selectedDifficulty)
          ) {
            return false;
          }
        }
        if (selectedTopicId == null) return true;
        const matchingChannelDbIds = channelTopics
          ?.filter((ct) => ct.topic_id === selectedTopicId)
          .map((ct) => ct.channel_id);
        const matchingChannelIds = channels
          ?.filter((ch) => matchingChannelDbIds?.includes(ch.id))
          .map((ch) => ch.channel_id);
        return matchingChannelIds?.includes(video.channel_id) ?? true;
      } else {
        const filter = DURATION_FILTERS[selectedDuration];
        if (filter.min === 0 && filter.max === Infinity) return true;
        if (video.duration == null) return selectedDuration === 0;
        return video.duration >= filter.min && video.duration < filter.max;
      }
    });
  }, [
    videos,
    searchText,
    selectedDuration,
    selectedTopicId,
    selectedDifficulty,
    showDifficultyFilter,
    mode,
    channelTopics,
    channels,
    channelDifficultyById,
  ]);

  const hasActiveFilters =
    searchText !== "" ||
    (mode === "duration" && selectedDuration !== 0) ||
    (mode === "topics" &&
      (selectedTopicId != null ||
        (showDifficultyFilter && selectedDifficulty != null)));

  const openFilter = () => {
    setDraftSearchText(searchText);
    setDraftDuration(selectedDuration);
    setDraftTopicId(selectedTopicId);
    setDraftDifficulty(selectedDifficulty);
    setFilterVisible(true);
  };

  const applyFilters = () => {
    setSearchText(draftSearchText);
    setSelectedDuration(draftDuration);
    setSelectedTopicId(draftTopicId);
    setSelectedDifficulty(draftDifficulty);
    setFilterVisible(false);
  };

  const clearFilters = () => {
    setSearchText("");
    setSelectedDuration(0);
    setSelectedTopicId(null);
    setSelectedDifficulty(null);
  };

  const filterDescriptions: string[] = [];
  if (searchText) filterDescriptions.push(`"${searchText}"`);
  if (mode === "duration" && selectedDuration !== 0)
    filterDescriptions.push(DURATION_FILTERS[selectedDuration].label);
  if (mode === "topics" && selectedTopicId != null) {
    const topicName = topics?.find(
      (t) => t.id === selectedTopicId,
    )?.description;
    if (topicName) filterDescriptions.push(topicName);
  }
  if (mode === "topics" && showDifficultyFilter && selectedDifficulty != null) {
    filterDescriptions.push(titleCase(selectedDifficulty));
  }

  const filterButton = (
    <TouchableOpacity style={styles.filterButton} onPress={openFilter}>
      <Ionicons
        name="options-outline"
        size={22}
        color={hasActiveFilters ? "#4a69bd" : "#5a5680"}
      />
    </TouchableOpacity>
  );

  const activeFilterBar = hasActiveFilters ? (
    <View style={styles.activeFilterBar}>
      <Text style={styles.activeFilterText}>
        Filtered: {filterDescriptions.join(", ")}
      </Text>
      <TouchableOpacity onPress={clearFilters}>
        <Ionicons name="close-circle" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <>
      {children({ filteredVideos, filterButton, activeFilterBar })}

      <Modal
        visible={filterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Videos</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>
              {mode === "topics"
                ? "Search by name or channel"
                : "Search by name"}
            </Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search videos..."
              placeholderTextColor="rgba(0, 0, 0, 0.4)"
              value={draftSearchText}
              onChangeText={setDraftSearchText}
              autoCorrect={false}
              autoComplete="off"
            />

            {mode === "duration" ? (
              <>
                <Text style={styles.filterLabel}>Duration</Text>
                <View style={styles.durationOptions}>
                  {DURATION_FILTERS.map((filter, index) => (
                    <TouchableOpacity
                      key={filter.label}
                      style={[
                        styles.durationChip,
                        draftDuration === index && styles.durationChipActive,
                      ]}
                      onPress={() => setDraftDuration(index)}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          draftDuration === index &&
                            styles.durationChipTextActive,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.filterLabel}>Topic</Text>
                <View style={styles.durationOptions}>
                  <TouchableOpacity
                    style={[
                      styles.durationChip,
                      draftTopicId == null && styles.durationChipActive,
                    ]}
                    onPress={() => setDraftTopicId(null)}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        draftTopicId == null && styles.durationChipTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {topics?.map((topic) => (
                    <TouchableOpacity
                      key={topic.id}
                      style={[
                        styles.durationChip,
                        draftTopicId === topic.id && styles.durationChipActive,
                      ]}
                      onPress={() => setDraftTopicId(topic.id)}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          draftTopicId === topic.id &&
                            styles.durationChipTextActive,
                        ]}
                      >
                        {topic.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {availableDifficulties.length > 0 && (
                  <>
                    <Text
                      style={[styles.filterLabel, styles.filterLabelSpacer]}
                    >
                      Difficulty
                    </Text>
                    <View style={styles.durationOptions}>
                      <TouchableOpacity
                        style={[
                          styles.durationChip,
                          draftDifficulty == null && styles.durationChipActive,
                        ]}
                        onPress={() => setDraftDifficulty(null)}
                      >
                        <Text
                          style={[
                            styles.durationChipText,
                            draftDifficulty == null &&
                              styles.durationChipTextActive,
                          ]}
                        >
                          All
                        </Text>
                      </TouchableOpacity>
                      {availableDifficulties.map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[
                            styles.durationChip,
                            draftDifficulty === d && styles.durationChipActive,
                          ]}
                          onPress={() => setDraftDifficulty(d)}
                        >
                          <Text
                            style={[
                              styles.durationChipText,
                              draftDifficulty === d &&
                                styles.durationChipTextActive,
                            ]}
                          >
                            {titleCase(d)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  filterButton: {
    paddingHorizontal: 8,
  },
  activeFilterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0f4ff",
    borderRadius: 8,
  },
  activeFilterText: {
    fontSize: 13,
    color: "#4a69bd",
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    width: "85%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "black",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  filterLabelSpacer: {
    marginTop: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 20,
  },
  durationOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  durationChipActive: {
    backgroundColor: "#4a69bd",
  },
  durationChipText: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
  },
  durationChipTextActive: {
    color: "white",
  },
  applyButton: {
    marginTop: 24,
    backgroundColor: "#4a69bd",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  applyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default FilterVideos;
