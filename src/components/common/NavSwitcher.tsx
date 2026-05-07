import React, { useState, useEffect } from "react";
import {
  View,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { ContextSegment, Sentence } from "../../types";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import SentenceSearchModal from "./SentenceSearchModal";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";

type NavSwitcherProps = {
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  children: React.ReactNode;
  totalItems: number;
  sentences?: Sentence[];
  onPlayClip?: (start: number) => void;
  videoId?: string;
  recordId?: string;
  hasSearch?: boolean;
  style?: StyleProp<ViewStyle>;
  showSearchIcon?: boolean;
  compact?: boolean;
};

const NavSwitcher: React.FC<NavSwitcherProps> = ({
  onPrev,
  onNext,
  currentIndex,
  children,
  totalItems,
  sentences = [],
  onPlayClip,
  videoId = "",
  recordId,
  hasSearch = true,
  style,
  showSearchIcon = true,
  compact = false,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [nextAvailableShadow, setNextAvailableShadow] = useState<number | null>(
    null,
  );
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();

  useEffect(() => {
    if (!supabase || !userId || !recordId) return;

    const fetchMaxShadowSentence = async () => {
      try {
        const { data, error } = await supabase
          .from("user_shadow_result")
          .select("sentence")
          .eq("user_id", userId)
          .eq("video_id", parseInt(recordId))
          .order("sentence", { ascending: false })
          .limit(1)
          .single();

        if (data && !error) {
          setNextAvailableShadow(data.sentence + 1);
        }
      } catch (err) {
        // No results yet
      }
    };

    fetchMaxShadowSentence();
  }, [supabase, userId, recordId, currentIndex]);

  const showJumpButton =
    nextAvailableShadow !== null &&
    nextAvailableShadow !== currentIndex &&
    nextAvailableShadow < totalItems &&
    Math.abs(nextAvailableShadow - currentIndex) > 1;
  const jumpIsForward =
    nextAvailableShadow !== null && currentIndex < nextAvailableShadow;

  const handleJump = () => {
    if (nextAvailableShadow === null) return;
    const sentence = sentences[nextAvailableShadow];
    if (sentence && onPlayClip) {
      onPlayClip(sentence.start);
    }
  };

  const navIconSize = compact ? 18 : 24;

  return (
    <View style={[styles.navHeader, compact && styles.navHeaderCompact, style]}>
      <View style={[styles.navButtonGroup, styles.navButtonGroupLeft]}>
        {showJumpButton && !jumpIsForward && (
          <TouchableOpacity
            style={[styles.navButton, compact && styles.navButtonCompact]}
            onPress={handleJump}
          >
            <Feather name="chevrons-left" size={navIconSize} color="#007AFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.navButton,
            compact && styles.navButtonCompact,
            currentIndex === 0 && styles.navButtonDisabled,
          ]}
          onPress={onPrev}
          disabled={currentIndex === 0}
        >
          <MaterialIcons
            name="chevron-left"
            size={navIconSize}
            color={currentIndex === 0 ? "#ccc" : "#333"}
          />
        </TouchableOpacity>
      </View>

      {hasSearch ? (
        <TouchableOpacity
          onPress={() => setIsSearchOpen(true)}
          style={styles.navCenter}
        >
          {/* {showSearchIcon && (
            <View style={styles.hiddenSearchIconContainer}>
              <MaterialIcons name="search" size={navIconSize} color="#333" />
            </View>
          )} */}
          {children}
          {/* {showSearchIcon && (
            <View style={styles.searchIconContainer}>
              <MaterialIcons name="search" size={navIconSize} color="#333" />
            </View>
          )} */}
        </TouchableOpacity>
      ) : (
        <View style={styles.navCenter}>{children}</View>
      )}

      <View style={[styles.navButtonGroup, styles.navButtonGroupRight]}>
        <TouchableOpacity
          style={[
            styles.navButton,
            compact && styles.navButtonCompact,
            currentIndex === totalItems - 1 && styles.navButtonDisabled,
          ]}
          onPress={onNext}
          disabled={currentIndex === totalItems - 1}
        >
          <MaterialIcons
            name="chevron-right"
            size={navIconSize}
            color={currentIndex === totalItems - 1 ? "#ccc" : "#333"}
          />
        </TouchableOpacity>
        {showJumpButton && jumpIsForward && (
          <TouchableOpacity
            style={[styles.navButton, compact && styles.navButtonCompact]}
            onPress={handleJump}
          >
            <Feather name="chevrons-right" size={navIconSize} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      <SentenceSearchModal
        visible={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        sentences={sentences}
        onPlayClip={onPlayClip}
        videoId={videoId}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fafafa",
  },
  navHeaderCompact: {
    paddingVertical: 30,
  },
  hiddenSearchIconContainer: {
    padding: 4,
    opacity: 0,
  },
  searchIconContainer: {
    padding: 4,
  },
  navButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  navButtonCompact: {
    padding: 3,
    borderRadius: 6,
  },
  navButtonDisabled: {
    backgroundColor: "#f8f8f8",
  },
  navButtonGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navButtonGroupLeft: {
    justifyContent: "flex-start",
  },
  navButtonGroupRight: {
    justifyContent: "flex-end",
  },
  navCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
});

export default NavSwitcher;
