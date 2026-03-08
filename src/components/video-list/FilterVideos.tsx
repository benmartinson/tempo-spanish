import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
} from "react-native";
import { Video } from "../../types";
import { Ionicons } from "@expo/vector-icons";

const DURATION_FILTERS = [
  { label: "All", min: 0, max: Infinity },
  { label: "< 1 min", min: 0, max: 60 },
  { label: "1–5 min", min: 60, max: 300 },
  { label: "5–15 min", min: 300, max: 900 },
  { label: "15+ min", min: 900, max: Infinity },
];

const FilterVideos: React.FC<{
  videos: Video[];
  children: (props: {
    filteredVideos: Video[];
    filterButton: React.ReactNode;
    activeFilterBar: React.ReactNode;
  }) => React.ReactNode;
}> = ({ videos, children }) => {
  const [filterVisible, setFilterVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(0);
  const [draftSearchText, setDraftSearchText] = useState("");
  const [draftDuration, setDraftDuration] = useState(0);

  const filteredVideos = useMemo(() => {
    const filter = DURATION_FILTERS[selectedDuration];
    return videos.filter((video) => {
      if (
        searchText &&
        !video.title.toLowerCase().includes(searchText.toLowerCase())
      ) {
        return false;
      }
      if (filter.min === 0 && filter.max === Infinity) return true;
      if (video.duration == null) return selectedDuration === 0;
      return video.duration >= filter.min && video.duration < filter.max;
    });
  }, [videos, searchText, selectedDuration]);

  const hasActiveFilters = searchText !== "" || selectedDuration !== 0;

  const openFilter = () => {
    setDraftSearchText(searchText);
    setDraftDuration(selectedDuration);
    setFilterVisible(true);
  };

  const applyFilters = () => {
    setSearchText(draftSearchText);
    setSelectedDuration(draftDuration);
    setFilterVisible(false);
  };

  const clearFilters = () => {
    setSearchText("");
    setSelectedDuration(0);
  };

  const filterDescriptions: string[] = [];
  if (searchText) filterDescriptions.push(`"${searchText}"`);
  if (selectedDuration !== 0)
    filterDescriptions.push(DURATION_FILTERS[selectedDuration].label);

  const filterButton = (
    <TouchableOpacity style={styles.filterButton} onPress={openFilter}>
      <Ionicons
        name="options-outline"
        size={22}
        color={hasActiveFilters ? "#4a69bd" : "black"}
      />
    </TouchableOpacity>
  );

  const activeFilterBar = hasActiveFilters ? (
    <View style={styles.activeFilterBar}>
      <Text style={styles.activeFilterText}>
        Filtered: {filterDescriptions.join(", ")} ({filteredVideos.length})
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

            <Text style={styles.filterLabel}>Search by name</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search videos..."
              value={draftSearchText}
              onChangeText={setDraftSearchText}
              autoCorrect={false}
              autoComplete="off"
            />

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
                      draftDuration === index && styles.durationChipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
    padding: 8,
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
    paddingHorizontal: 14,
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
