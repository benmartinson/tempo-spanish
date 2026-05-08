import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageStyle,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { backendFetch } from "../helpers/backendFetch";
import { useSupabaseWithClerk } from "../../utils/supabase";

type YouTubeChannel = {
  id: string;
  title?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
};

const generateVerificationCode = () =>
  `TEMP-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`.toUpperCase();

interface CreatorSignUpPageProps {
  onBack?: () => void;
}

const CreatorSignUpPage: React.FC<CreatorSignUpPageProps> = ({ onBack }) => {
  const navigation = useNavigation<any>();
  const { userId } = useAuth();
  const supabase = useSupabaseWithClerk();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<YouTubeChannel[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  const selectedChannelIds = useMemo(
    () => new Set(selectedChannels.map((channel) => channel.id)),
    [selectedChannels],
  );
  const visibleResults = useMemo(
    () => results.filter((channel) => !selectedChannelIds.has(channel.id)),
    [results, selectedChannelIds],
  );
  const hasSearchQuery = query.trim().length >= 2;

  useEffect(() => {
    setQuery("");
    setResults([]);
    setSelectedChannels([]);
    setSearchError(null);
    setRequestError(null);
    setIsSearching(false);
    setIsSubmitting(false);
    setRequestSent(false);
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const response = await backendFetch(
          `/api/youtube-channel-search?q=${encodeURIComponent(trimmedQuery)}`,
        );
        if (!response.ok) {
          let detail = "Could not search YouTube channels.";
          try {
            const data = await response.json();
            detail = data.detail ?? detail;
          } catch {
            detail = await response.text();
          }
          throw new Error(detail);
        }

        const data = await response.json();
        if (!cancelled) {
          setResults(data.channels ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error searching YouTube channels:", err);
          setSearchError(
            err instanceof Error
              ? err.message
              : "Could not search YouTube channels.",
          );
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const toggleChannel = (channel: YouTubeChannel) => {
    setRequestSent(false);
    setRequestError(null);
    setSelectedChannels((current) => {
      if (current.some((selected) => selected.id === channel.id)) {
        return current.filter((selected) => selected.id !== channel.id);
      }
      return [...current, channel];
    });
  };

  const showRequestError = (message: string) => {
    setRequestError(message);
    if (Platform.OS === "web") {
      window.alert(message);
      return;
    }
    Alert.alert("Could not request access", message);
  };

  const handleRequestAccess = async () => {
    if (selectedChannels.length === 0) return;
    if (!supabase || !userId) {
      showRequestError("Sign in before requesting creator access.");
      return;
    }

    setIsSubmitting(true);
    setRequestError(null);
    setRequestSent(false);
    try {
      const { data: role, error: roleError } = await supabase
        .from("user_role")
        .upsert(
          {
            user_id: userId,
            role: "creator",
          },
          { onConflict: "user_id,role" },
        )
        .select("id")
        .single();

      if (roleError) throw roleError;
      if (!role?.id) throw new Error("Creator role was not returned.");

      const requestRows = selectedChannels.map((channel) => ({
        user_role_id: role.id,
        user_id: userId,
        channel_id: channel.id,
        channel_title: channel.title ?? null,
        channel_thumbnail_url: channel.thumbnail_url ?? null,
        status: "pending",
        verification_code: generateVerificationCode(),
      }));

      const { error: requestError } = await supabase
        .from("channel_approval_request")
        .upsert(requestRows, {
          onConflict: "user_role_id,channel_id",
          ignoreDuplicates: true,
        });

      if (requestError) throw requestError;

      setRequestSent(true);
      navigation.navigate({
        name: "MainApp",
        params: { creatorRequests: true },
        merge: false,
      });
    } catch (err) {
      console.error("Error requesting creator access:", err);
      showRequestError(
        err instanceof Error
          ? err.message
          : "Could not create your approval requests.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderChannel = (channel: YouTubeChannel) => {
    const selected = selectedChannelIds.has(channel.id);
    return (
      <TouchableOpacity
        key={channel.id}
        style={[styles.channelRow, selected && styles.channelRowSelected]}
        onPress={() => toggleChannel(channel)}
        activeOpacity={0.72}
      >
        {channel.thumbnail_url ? (
          <Image
            source={{ uri: channel.thumbnail_url }}
            style={styles.channelThumbnail as ImageStyle}
          />
        ) : (
          <View style={styles.channelThumbnailFallback}>
            <MaterialIcons name="smart-display" size={20} color="#5a5680" />
          </View>
        )}
        <View style={styles.channelText}>
          <Text style={styles.channelTitle} numberOfLines={1}>
            {channel.title ?? "Untitled channel"}
          </Text>
          <Text style={styles.channelId} numberOfLines={1}>
            Channel Id: {channel.id}
          </Text>
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <MaterialIcons name="check" size={15} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.page}>
      <View style={styles.inner}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Become a Creator</Text>
              <Text style={styles.subtitle}>
                Find your YouTube channels. Get paid when your content is used
                by Tempo users.
              </Text>
            </View>
            {onBack && (
              <TouchableOpacity style={styles.closeButton} onPress={onBack}>
                <MaterialIcons name="close" size={20} color="#6f7482" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color="#7a8090" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search channels"
              placeholderTextColor="#a4a7b0"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isSearching && <ActivityIndicator size="small" color="#3d3a52" />}
          </View>

          <ScrollView
            style={styles.results}
            contentContainerStyle={styles.resultsContent}
            keyboardShouldPersistTaps="handled"
          >
            {selectedChannels.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Selected</Text>
                {selectedChannels.map(renderChannel)}
              </>
            )}

            {(searchError ||
              (hasSearchQuery &&
                (isSearching || visibleResults.length > 0))) && (
              <>
                <Text style={styles.sectionLabel}>Search Results</Text>
                {searchError ? (
                  <Text style={styles.emptyText}>{searchError}</Text>
                ) : isSearching && visibleResults.length === 0 ? (
                  <Text style={styles.emptyText}>Searching...</Text>
                ) : (
                  visibleResults.map(renderChannel)
                )}
              </>
            )}

            {requestSent && (
              <Text style={styles.sentText}>
                Request prepared for {selectedChannels.length} channel
                {selectedChannels.length === 1 ? "" : "s"}.
              </Text>
            )}
            {requestError && (
              <Text style={styles.errorText}>{requestError}</Text>
            )}
          </ScrollView>

          {selectedChannels.length > 0 && (
            <View style={styles.requestFooter}>
              <TouchableOpacity
                style={styles.requestButton}
                onPress={handleRequestAccess}
                disabled={isSubmitting}
                activeOpacity={0.76}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.requestButtonText}>
                    Request Access to {selectedChannels.length} Channel
                    {selectedChannels.length === 1 ? "" : "s"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  inner: {
    flex: 1,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  card: {
    flex: 1,
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  title: {
    color: "#1a1a2e",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6f7482",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f8",
  },
  searchBox: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#d8dce8",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fbfcff",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: "600",
    outlineStyle: "none" as any,
  },
  results: {
    marginTop: 14,
  },
  resultsContent: {
    gap: 9,
    paddingBottom: 12,
  },
  sectionLabel: {
    color: "#8e8e93",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 3,
  },
  channelRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e6f0",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fbfcff",
  },
  channelRowSelected: {
    borderColor: "#3d3a52",
    backgroundColor: "#f7f6fb",
  },
  channelThumbnail: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  channelThumbnailFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef1f8",
  },
  channelText: {
    flex: 1,
    minWidth: 0,
  },
  channelTitle: {
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: "800",
  },
  channelId: {
    color: "#7a8090",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#c8c8d0",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#3d3a52",
    borderColor: "#3d3a52",
  },
  emptyText: {
    color: "#7a8090",
    fontSize: 14,
    lineHeight: 20,
  },
  sentText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  errorText: {
    color: "#d33b3b",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  requestButton: {
    minHeight: 36,
    minWidth: 132,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d3a52",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  requestFooter: {
    alignItems: "flex-end",
    marginTop: 14,
  },
  requestButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
});

export default CreatorSignUpPage;
