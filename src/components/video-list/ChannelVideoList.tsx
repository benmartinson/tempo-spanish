import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
} from "react-native";
import { Channel, Video } from "../../types";
import { Ionicons } from "@expo/vector-icons";
import VideoCard from "./VideoCard";

const DURATION_FILTERS = [
  { label: "All", min: 0, max: Infinity },
  { label: "< 1 min", min: 0, max: 60 },
  { label: "1–5 min", min: 60, max: 300 },
  { label: "5–15 min", min: 300, max: 900 },
  { label: "15+ min", min: 900, max: Infinity },
];

const ChannelVideoList: React.FC<{
  channel: Channel;
  videos: Video[];
  handleWatchPress: (videoId: string, recordId: string) => void;
  loadingVideo: boolean;
  onBack: () => void;
}> = ({ channel, videos, handleWatchPress, loadingVideo, onBack }) => {
  const [filterVisible, setFilterVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(0);
  // Draft state for the modal (only applied on "Apply")
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="black" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={openFilter}
        >
          <Ionicons
            name="options-outline"
            size={22}
            color={hasActiveFilters ? "#4a69bd" : "black"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.channelHeader}>
        <Image
          source={{ uri: channel.thumbnail_url }}
          style={styles.channelThumbnail}
        />
        <View style={styles.channelInfo}>
          <Text style={styles.channelTitle}>{channel.title}</Text>
          <View style={styles.channelBadges}>
            {channel.topic && <Text>{channel.topic}</Text>}
            <Text>{videos.length} videos</Text>
          </View>
        </View>
      </View>

      {hasActiveFilters && (
        <View style={styles.activeFilterBar}>
          <Text style={styles.activeFilterText}>
            Filtered: {filterDescriptions.join(", ")} ({filteredVideos.length})
          </Text>
          <TouchableOpacity onPress={clearFilters}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.videoList}>
        {filteredVideos.map((video) => (
          <VideoCard
            key={video.video_id}
            video={video}
            onPress={() => handleWatchPress(video.video_id, video.id)}
            disabled={loadingVideo}
            style={styles.videoItem}
          />
        ))}
      </View>

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
                      draftDuration === index &&
                        styles.durationChipTextActive,
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  backText: {
    fontSize: 16,
    color: "black",
  },
  filterButton: {
    padding: 8,
  },
  channelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  channelThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 10,
  },
  channelInfo: {
    flex: 1,
    paddingRight: 8,
    paddingTop: 8,
  },
  channelTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "black",
  },
  channelBadges: {
    marginTop: 4,
    gap: 2,
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
  videoList: {
    paddingHorizontal: 16,
  },
  videoItem: {
    marginBottom: 16,
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

export default ChannelVideoList;
