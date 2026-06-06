import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { TranscriptPhraseMatch, UserComposition } from "../../requests";
import { formatTimestamp } from "../../helpers/helpers";
import type { Channel, LanguageCode, Segment, Video } from "../../types";
import FindVideoMatch from "./FindVideoMatch";
import VideoTranscriptImport, {
  type VideoTranscriptSearchResult,
} from "./VideoTranscriptImport";

export interface CompositionTemplate {
  id: string;
  title: string;
  topic: string;
  text: string;
}

const COMPOSITION_TEMPLATES: CompositionTemplate[] = [
  {
    id: "daily-moment",
    title: "A Moment From Today",
    topic: "Personal story",
    text: "Hoy paso algo pequeno que me hizo pensar. Al principio no parecia importante, pero despues entendi que tenia algo que aprender.",
  },
  {
    id: "strong-opinion",
    title: "A Clear Opinion",
    topic: "Opinion",
    text: "Creo que una buena conversacion empieza cuando las personas escuchan de verdad. Para mi, escuchar bien es tan importante como hablar con confianza.",
  },
  {
    id: "future-plans",
    title: "Future Plans",
    topic: "Goals",
    text: "En el futuro quiero sentirme mas comodo hablando en otro idioma. No necesito sonar perfecto, pero si quiero expresar mis ideas con calma.",
  },
  {
    id: "travel-memory",
    title: "Travel Memory",
    topic: "Experience",
    text: "La primera vez que visite un lugar nuevo, me sorprendio la energia de la gente. Recuerdo un detalle pequeno que todavia me hace sonreir.",
  },
  {
    id: "small-challenge",
    title: "A Small Challenge",
    topic: "Reflection",
    text: "Hace poco tuve que resolver un problema que parecia simple, pero me costo mas de lo esperado. Esa experiencia me enseno a tener mas paciencia.",
  },
  {
    id: "give-advice",
    title: "Giving Advice",
    topic: "Advice",
    text: "Si pudiera darle un consejo a alguien que esta empezando, le diria que avance poco a poco. La constancia ayuda mas que la motivacion de un solo dia.",
  },
];

const OPTIONS_MENU_WIDTH = 164;

interface ChooseCompositionProps {
  savedCompositions: UserComposition[];
  isLoadingSavedCompositions: boolean;
  savedCompositionError: string | null;
  isSignedIn: boolean;
  allChannels: Channel[];
  publicSupabase: any;
  targetLanguage: LanguageCode | null;
  targetLanguageVideos: Video[];
  onBlankCanvas: () => void;
  onChooseTemplate: (template: CompositionTemplate) => void;
  onChooseVideoTranscript: (
    result: VideoTranscriptSearchResult,
    segments: Segment[],
  ) => void;
  onChooseVideoTranscriptRange: (
    result: VideoTranscriptSearchResult,
    segments: Segment[],
    startIndex: number,
    endIndex: number,
  ) => void;
  onPreviewVideoMatch?: (match: TranscriptPhraseMatch | null) => void;
  onChooseSavedComposition: (composition: UserComposition) => void;
  onCopySavedComposition: (composition: UserComposition) => Promise<void>;
  onDeleteSavedComposition: (composition: UserComposition) => Promise<void>;
  onQuickRefreshSavedComposition?: (
    composition: UserComposition,
  ) => Promise<void>;
}

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const ChooseComposition: React.FC<ChooseCompositionProps> = ({
  savedCompositions,
  isLoadingSavedCompositions,
  savedCompositionError,
  isSignedIn,
  allChannels,
  publicSupabase,
  targetLanguage,
  targetLanguageVideos,
  onBlankCanvas,
  onChooseTemplate,
  onChooseVideoTranscript,
  onChooseVideoTranscriptRange,
  onPreviewVideoMatch,
  onChooseSavedComposition,
  onCopySavedComposition,
  onDeleteSavedComposition,
  onQuickRefreshSavedComposition,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const optionsButtonRefs = useRef<Record<string, any>>({});
  const [view, setView] = useState<
    "main" | "templates" | "videoTranscript" | "findVideoMatch"
  >("videoTranscript");
  const [compositionToDelete, setCompositionToDelete] =
    useState<UserComposition | null>(null);
  const [deletingCompositionId, setDeletingCompositionId] = useState<
    string | number | null
  >(null);
  const [copyingCompositionId, setCopyingCompositionId] = useState<
    string | number | null
  >(null);
  const [quickRefreshingCompositionId, setQuickRefreshingCompositionId] =
    useState<string | number | null>(null);
  const [optionsCompositionId, setOptionsCompositionId] = useState<
    string | number | null
  >(null);
  const [optionsMenuPosition, setOptionsMenuPosition] = useState({
    left: 12,
    top: 12,
  });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savedClipTimesByCompositionId, setSavedClipTimesByCompositionId] =
    useState<Record<string, string>>({});
  const targetLanguageSavedCompositions = useMemo(
    () =>
      targetLanguage
        ? savedCompositions.filter(
            (composition) => composition.language === targetLanguage,
          )
        : [],
    [savedCompositions, targetLanguage],
  );
  const savedEmptyLabel = isSignedIn
    ? "No saved compositions yet."
    : "Sign in to save and reopen compositions.";
  const optionsComposition = useMemo(
    () =>
      optionsCompositionId
        ? targetLanguageSavedCompositions.find(
            (composition) =>
              String(composition.id) === String(optionsCompositionId),
          )
        : null,
    [optionsCompositionId, targetLanguageSavedCompositions],
  );

  useEffect(() => {
    let cancelled = false;

    const loadSavedClipTimes = async () => {
      const videoCompositions = targetLanguageSavedCompositions.filter(
        (composition) =>
          composition.video_id &&
          typeof composition.segment_start === "number" &&
          typeof composition.segment_end === "number",
      );

      if (!videoCompositions.length) {
        setSavedClipTimesByCompositionId({});
        return;
      }

      const videoRecordIds = Array.from(
        new Set(videoCompositions.map((composition) => composition.video_id)),
      ).filter(Boolean);

      try {
        const { data, error } = await publicSupabase
          .from("transcript_segment")
          .select("segment_id,start,end,text,video_id")
          .in("video_id", videoRecordIds)
          .order("segment_id");

        if (error) {
          console.error(error);
          throw new Error("Failed to load saved clip times");
        }

        const segmentsByVideoId = new Map<string, Segment[]>();
        for (const segment of ((data ?? []) as Segment[]).filter((item) =>
          Boolean(item.text?.trim()),
        )) {
          const existing = segmentsByVideoId.get(segment.video_id) ?? [];
          existing.push(segment);
          segmentsByVideoId.set(segment.video_id, existing);
        }

        const nextTimes: Record<string, string> = {};
        for (const composition of videoCompositions) {
          if (!composition.video_id) continue;

          const segments = segmentsByVideoId.get(composition.video_id);
          if (!segments?.length) continue;

          const startIndex = Math.max(
            0,
            Math.min(composition.segment_start ?? 0, segments.length - 1),
          );
          const endIndex = Math.max(
            0,
            Math.min(
              composition.segment_end ?? startIndex,
              segments.length - 1,
            ),
          );
          const startSegment = segments[Math.min(startIndex, endIndex)];
          const endSegment = segments[Math.max(startIndex, endIndex)];

          if (!startSegment || !endSegment) continue;
          nextTimes[String(composition.id)] = `${formatTimestamp(
            startSegment.start,
          )} - ${formatTimestamp(endSegment.end)}`;
        }

        if (!cancelled) setSavedClipTimesByCompositionId(nextTimes);
      } catch {
        if (!cancelled) setSavedClipTimesByCompositionId({});
      }
    };

    void loadSavedClipTimes();

    return () => {
      cancelled = true;
    };
  }, [publicSupabase, targetLanguageSavedCompositions]);

  const closeDeleteModal = () => {
    if (deletingCompositionId !== null) return;
    setOptionsCompositionId(null);
    setCompositionToDelete(null);
    setDeleteError(null);
  };

  const confirmDeleteComposition = async () => {
    if (!compositionToDelete || deletingCompositionId !== null) return;

    setDeletingCompositionId(compositionToDelete.id);
    setOptionsCompositionId(null);
    setDeleteError(null);
    try {
      await onDeleteSavedComposition(compositionToDelete);
      setCompositionToDelete(null);
    } catch {
      setDeleteError("Could not delete this composition.");
    } finally {
      setDeletingCompositionId(null);
    }
  };

  const openSavedComposition = (composition: UserComposition) => {
    setOptionsCompositionId(null);
    onChooseSavedComposition(composition);
  };

  const copySavedComposition = async (composition: UserComposition) => {
    if (copyingCompositionId !== null) return;

    setCopyingCompositionId(composition.id);
    setOptionsCompositionId(null);
    setDeleteError(null);
    try {
      await onCopySavedComposition(composition);
    } finally {
      setCopyingCompositionId(null);
    }
  };

  const quickRefreshSavedComposition = (composition: UserComposition) => {
    if (quickRefreshingCompositionId !== null) return;

    setQuickRefreshingCompositionId(composition.id);
    setOptionsCompositionId(null);
    setDeleteError(null);
    void onQuickRefreshSavedComposition?.(composition);
  };

  const toggleOptionsMenu = (composition: UserComposition) => {
    const compositionId = String(composition.id);
    if (String(optionsCompositionId) === compositionId) {
      setOptionsCompositionId(null);
      return;
    }

    const buttonRef = optionsButtonRefs.current[compositionId];
    buttonRef?.measureInWindow?.(
      (x: number, y: number, buttonWidth: number, buttonHeight: number) => {
        setOptionsMenuPosition({
          left: Math.min(
            Math.max(12, windowWidth - OPTIONS_MENU_WIDTH - 12),
            Math.max(12, x + buttonWidth - OPTIONS_MENU_WIDTH),
          ),
          top: y + buttonHeight + 6,
        });
      },
    );
    setOptionsCompositionId(composition.id);
  };

  if (view === "templates") {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <Pressable style={styles.backButton} onPress={() => setView("main")}>
          <Ionicons name="arrow-back" size={16} color="#3d3a52" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <View style={styles.list}>
          {COMPOSITION_TEMPLATES.map((template) => (
            <Pressable
              key={template.id}
              style={styles.row}
              onPress={() => onChooseTemplate(template)}
            >
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {template.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {template.topic}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  if (view === "videoTranscript") {
    return (
      <VideoTranscriptImport
        allChannels={allChannels}
        publicSupabase={publicSupabase}
        targetLanguageVideos={targetLanguageVideos}
        onBack={() => setView("main")}
        onFindGoodMatch={() => setView("findVideoMatch")}
        onChooseVideoTranscript={onChooseVideoTranscript}
      />
    );
  }

  if (view === "findVideoMatch") {
    return (
      <FindVideoMatch
        allChannels={allChannels}
        publicSupabase={publicSupabase}
        targetLanguage={targetLanguage}
        targetLanguageVideos={targetLanguageVideos}
        onBack={() => setView("videoTranscript")}
        onPreviewVideoMatch={onPreviewVideoMatch}
        onChooseVideoTranscriptRange={onChooseVideoTranscriptRange}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.content}
        onPress={() => setOptionsCompositionId(null)}
      >
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>
            Start fresh, import a transcript, or reopen saved work.
          </Text>
        </View>
        <View style={styles.list}>
          <Pressable
            style={styles.row}
            onPress={() => setView("videoTranscript")}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="film-outline" size={18} color="#26705d" />
            </View>
            <Text style={styles.rowTitle}>Video Transcript</Text>
            <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
          </Pressable>

          <Pressable style={styles.row} onPress={onBlankCanvas}>
            <View style={styles.rowIcon}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color="#26705d"
              />
            </View>
            <Text style={styles.rowTitle}>Blank Canvas</Text>
            <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
          </Pressable>

          {/* <Pressable style={styles.row} onPress={() => setView("templates")}>
            <View style={styles.rowIcon}>
              <Ionicons name="albums-outline" size={18} color="#26705d" />
            </View>
            <Text style={styles.rowTitle}>Template</Text>
            <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
          </Pressable> */}
        </View>
        <View style={styles.savedHeader}>
          <Text style={styles.savedHeaderText}>Saved</Text>
          {isLoadingSavedCompositions && (
            <ActivityIndicator size="small" color="#5a5680" />
          )}
        </View>
        <View style={styles.savedListContainer}>
          {savedCompositionError ? (
            <Text style={styles.emptyText}>{savedCompositionError}</Text>
          ) : targetLanguageSavedCompositions.length ? (
            <ScrollView
              style={styles.savedListScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.list}>
                {targetLanguageSavedCompositions.map((composition) => {
                  const isDeleting =
                    String(deletingCompositionId) === String(composition.id);
                  const isCopying =
                    String(copyingCompositionId) === String(composition.id);
                  const isQuickRefreshing =
                    String(quickRefreshingCompositionId) ===
                    String(composition.id);
                  const isBusy = isDeleting || isCopying || isQuickRefreshing;
                  const isOptionsOpen =
                    String(optionsCompositionId) === String(composition.id);
                  const savedVideo = composition.video_id
                    ? targetLanguageVideos.find(
                        (video) =>
                          String(video.id) === String(composition.video_id),
                      )
                    : null;
                  const thumbnailUrl = savedVideo?.thumbnail_url;
                  const savedClipTime =
                    savedClipTimesByCompositionId[String(composition.id)] ??
                    null;

                  return (
                    <Pressable
                      key={String(composition.id)}
                      style={[
                        styles.row,
                        isOptionsOpen && styles.rowWithOpenMenu,
                      ]}
                      onPress={() => openSavedComposition(composition)}
                      disabled={isBusy}
                    >
                      {composition.video_id && (
                        <View style={styles.savedVideoThumbnailShell}>
                          {thumbnailUrl ? (
                            <Image
                              source={{ uri: thumbnailUrl }}
                              style={styles.savedVideoThumbnail}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons
                              name="videocam"
                              size={17}
                              color="#000000"
                            />
                          )}
                        </View>
                      )}
                      <View style={styles.rowTextGroup}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {composition.title || "Untitled composition"}
                        </Text>
                        <View style={styles.rowMetaLine}>
                          <Text style={styles.rowMeta}>
                            {formatDate(composition.updated_at)}
                          </Text>
                          {savedClipTime && (
                            <>
                              <View style={styles.rowMetaDot} />
                              <Text style={styles.rowClipTime}>
                                {savedClipTime}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                      <View style={styles.rowActions}>
                        <Pressable
                          ref={(ref) => {
                            optionsButtonRefs.current[String(composition.id)] =
                              ref;
                          }}
                          style={[
                            styles.moreButton,
                            isOptionsOpen && styles.moreButtonActive,
                          ]}
                          onPress={(event) => {
                            event.stopPropagation();
                            setDeleteError(null);
                            toggleOptionsMenu(composition);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="More composition options"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          disabled={isBusy}
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#697187" />
                          ) : (
                            <Ionicons
                              name="ellipsis-horizontal"
                              size={17}
                              color="#697187"
                            />
                          )}
                        </Pressable>
                        <Ionicons
                          name="arrow-forward"
                          size={17}
                          color="#3d3a52"
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>{savedEmptyLabel}</Text>
          )}
        </View>
      </Pressable>
      <Modal
        visible={Boolean(optionsComposition)}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsCompositionId(null)}
      >
        <Pressable
          style={styles.optionsModalOverlay}
          onPress={() => setOptionsCompositionId(null)}
        >
          {optionsComposition && (
            <Pressable
              style={[
                styles.optionsMenu,
                {
                  left: optionsMenuPosition.left,
                  top: optionsMenuPosition.top,
                },
              ]}
              onPress={(event) => event.stopPropagation()}
            >
              <Pressable
                style={styles.optionsMenuItem}
                onPress={(event) => {
                  event.stopPropagation();
                  openSavedComposition(optionsComposition);
                }}
              >
                <Ionicons name="open-outline" size={14} color="#3d3a52" />
                <Text style={styles.optionsMenuText}>Open</Text>
              </Pressable>
              <Pressable
                style={styles.optionsMenuItem}
                onPress={(event) => {
                  event.stopPropagation();
                  void copySavedComposition(optionsComposition);
                }}
              >
                <Ionicons name="copy-outline" size={14} color="#3d3a52" />
                <Text style={styles.optionsMenuText}>Copy</Text>
              </Pressable>
              <Pressable
                style={styles.optionsMenuItem}
                onPress={(event) => {
                  event.stopPropagation();
                  quickRefreshSavedComposition(optionsComposition);
                }}
              >
                <Ionicons name="flash-outline" size={14} color="#3d3a52" />
                <Text style={styles.optionsMenuText}>Quick refresher</Text>
              </Pressable>
              <View style={styles.optionsMenuDivider} />
              <Pressable
                style={styles.optionsMenuItem}
                onPress={(event) => {
                  event.stopPropagation();
                  setOptionsCompositionId(null);
                  setCompositionToDelete(optionsComposition);
                  setDeleteError(null);
                }}
              >
                <Ionicons name="trash-outline" size={14} color="#9f3c3c" />
                <Text style={[styles.optionsMenuText, styles.deleteText]}>
                  Delete
                </Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>
      <Modal
        visible={Boolean(compositionToDelete)}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeDeleteModal}>
          <Pressable
            style={styles.confirmCard}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.confirmIcon}>
              <Ionicons name="trash-outline" size={20} color="#9f3c3c" />
            </View>
            <Text style={styles.confirmTitle}>Delete composition?</Text>
            <Text style={styles.confirmText}>
              This will permanently remove{" "}
              <Text style={styles.confirmTextStrong}>
                {compositionToDelete?.title || "Untitled composition"}
              </Text>
              .
            </Text>
            {deleteError && (
              <Text style={styles.deleteError}>{deleteError}</Text>
            )}
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={closeDeleteModal}
                disabled={deletingCompositionId !== null}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.deleteConfirmButton]}
                onPress={confirmDeleteComposition}
                disabled={deletingCompositionId !== null}
              >
                {deletingCompositionId !== null ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.deleteConfirmButtonText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
    cursor: "default" as any,
  },
  header: {
    gap: 3,
  },
  headerTitle: {
    color: "#2f3140",
    fontSize: 16,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#697187",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.12)",
    overflow: "visible",
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.12)",
    overflow: "visible",
    cursor: "pointer" as any,
  },
  rowWithOpenMenu: {
    zIndex: 20,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf4f2",
  },
  savedVideoThumbnailShell: {
    width: 72,
    height: 40,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    overflow: "hidden",
    borderRadius: 2,
  },
  savedVideoThumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  rowTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    flex: 1,
    color: "#2f3140",
    fontSize: 14,
    fontWeight: "900",
  },
  rowMeta: {
    color: "#697187",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  rowMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#b1b8c7",
  },
  rowClipTime: {
    color: "#26705d",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
  },
  rowMetaLine: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowActions: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    overflow: "visible",
  },
  moreButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f6f7fa",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
    cursor: "pointer" as any,
  },
  moreButtonActive: {
    backgroundColor: "#eef2f8",
    borderColor: "rgba(74, 105, 189, 0.24)",
  },
  optionsMenu: {
    position: "absolute",
    width: 164,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    shadowColor: "#1f2330",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    zIndex: 30,
  },
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  optionsMenuItem: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    cursor: "pointer" as any,
  },
  optionsMenuText: {
    color: "#3d3a52",
    fontSize: 12,
    fontWeight: "800",
  },
  deleteText: {
    color: "#9f3c3c",
  },
  optionsMenuDivider: {
    height: 1,
    marginVertical: 4,
    backgroundColor: "rgba(74, 105, 189, 0.1)",
  },
  videoBadge: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  savedHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  savedHeaderText: {
    color: "#697187",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  savedListContainer: {
    flex: 1,
    minHeight: 0,
  },
  savedListScroll: {
    flex: 1,
    minHeight: 0,
  },
  emptyText: {
    color: "#697187",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  backButton: {
    minHeight: 34,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 10,
  },
  backButtonText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(31, 35, 48, 0.28)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
    gap: 10,
  },
  confirmIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "rgba(159, 60, 60, 0.14)",
  },
  confirmTitle: {
    color: "#2f3140",
    fontSize: 17,
    fontWeight: "900",
  },
  confirmText: {
    color: "#697187",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
  },
  confirmTextStrong: {
    color: "#2f3140",
    fontWeight: "900",
  },
  deleteError: {
    color: "#9f3c3c",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  confirmActions: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  confirmButton: {
    minWidth: 92,
    minHeight: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cancelButton: {
    backgroundColor: "#f3f5f8",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
  },
  cancelButtonText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "900",
  },
  deleteConfirmButton: {
    backgroundColor: "#9f3c3c",
  },
  deleteConfirmButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
});

export default ChooseComposition;
