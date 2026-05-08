import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageStyle,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { useSupabaseWithClerk } from "../../utils/supabase";

const FAKE_UNLISTED_VIDEO_URL =
  "https://youtube.com/watch?v=tempo_creator_auth";

type ChannelApprovalRequest = {
  id: string;
  channel_id: string;
  channel_title: string | null;
  channel_thumbnail_url: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  verification_code: string;
  created_at: string;
};

interface CreatorRequestsPageProps {
  onBack?: () => void;
}

const CreatorRequestsPage: React.FC<CreatorRequestsPageProps> = ({
  onBack,
}) => {
  const { userId } = useAuth();
  const supabase = useSupabaseWithClerk();
  const [requests, setRequests] = useState<ChannelApprovalRequest[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(
    null,
  );
  const [paypalEmails, setPaypalEmails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!supabase || !userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const fetchRequests = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: requestError } = await supabase
          .from("channel_approval_request")
          .select(
            "id, channel_id, channel_title, channel_thumbnail_url, status, verification_code, created_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (requestError) throw requestError;
        if (!cancelled) {
          setRequests((data ?? []) as ChannelApprovalRequest[]);
        }
      } catch (err) {
        console.error("Error loading creator requests:", err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load creator requests.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchRequests();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const toggleExpanded = (requestId: string) => {
    setSubmittedRequestId(null);
    setExpandedRequestId((current) =>
      current === requestId ? null : requestId,
    );
  };

  const updatePaypalEmail = (requestId: string, email: string) => {
    setPaypalEmails((current) => ({ ...current, [requestId]: email }));
  };

  const renderRequest = (request: ChannelApprovalRequest) => {
    const expanded = expandedRequestId === request.id;
    const paypalEmail = paypalEmails[request.id] ?? "";
    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.requestSummary}>
          {request.channel_thumbnail_url ? (
            <Image
              source={{ uri: request.channel_thumbnail_url }}
              style={styles.thumbnail as ImageStyle}
            />
          ) : (
            <View style={styles.thumbnailFallback}>
              <MaterialIcons name="smart-display" size={22} color="#5a5680" />
            </View>
          )}
          <View style={styles.requestText}>
            <Text style={styles.channelTitle} numberOfLines={1}>
              {request.channel_title ?? "Untitled channel"}
            </Text>
            <Text style={styles.channelId} numberOfLines={1}>
              Channel Id: {request.channel_id}
            </Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{request.status}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.approvalButton}
            onPress={() => toggleExpanded(request.id)}
            activeOpacity={0.76}
          >
            <Text style={styles.approvalButtonText}>
              {expanded ? "Hide" : "Get Approval"}
            </Text>
          </TouchableOpacity>
        </View>

        {expanded && (
          <View style={styles.approvalPanel}>
            <Text style={styles.panelTitle}>Approval Instructions</Text>
            <Text style={styles.instructionText}>
              Open the unlisted video, comment with your verification code from
              the YouTube channel you requested, then come back here and submit
              your PayPal email.
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Verification Code</Text>
              <Text style={styles.codeText}>{request.verification_code}</Text>
            </View>

            <TouchableOpacity
              style={styles.videoLinkRow}
              onPress={() => Linking.openURL(FAKE_UNLISTED_VIDEO_URL)}
              activeOpacity={0.72}
            >
              <Text style={styles.videoLinkText} numberOfLines={1}>
                {FAKE_UNLISTED_VIDEO_URL}
              </Text>
              <MaterialIcons name="open-in-new" size={18} color="#3d3a52" />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>PayPal Email</Text>
            <TextInput
              style={styles.input}
              value={paypalEmail}
              onChangeText={(email) => updatePaypalEmail(request.id, email)}
              placeholder="creator@example.com"
              placeholderTextColor="#a4a7b0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.getApprovedButton}
              onPress={() => setSubmittedRequestId(request.id)}
              activeOpacity={0.76}
            >
              <Text style={styles.getApprovedButtonText}>Get Approved</Text>
            </TouchableOpacity>
            {submittedRequestId === request.id && (
              <Text style={styles.pendingText}>
                Approval check queued. This button is a placeholder for now.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.page}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Creator Requests</Text>
            <Text style={styles.subtitle}>Finish channel approval</Text>
          </View>
          {onBack && (
            <TouchableOpacity style={styles.closeButton} onPress={onBack}>
              <MaterialIcons name="close" size={20} color="#6f7482" />
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#5a5680" />
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyText}>No creator requests yet.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {requests.map(renderRequest)}
          </ScrollView>
        )}
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
    backgroundColor: "#eceef4",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    color: "#7a8090",
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    color: "#d33b3b",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e6f0",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  requestSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  thumbnail: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  thumbnailFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef1f8",
  },
  requestText: {
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
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#f1eff8",
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  statusText: {
    color: "#3d3a52",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  approvalButton: {
    minHeight: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d3a52",
    paddingHorizontal: 12,
  },
  approvalButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  approvalPanel: {
    borderTopWidth: 1,
    borderTopColor: "#edf0f6",
    marginTop: 12,
    paddingTop: 12,
    gap: 10,
  },
  panelTitle: {
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: "800",
  },
  instructionText: {
    color: "#5f6472",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  codeBox: {
    borderRadius: 10,
    backgroundColor: "#f7f6fb",
    borderWidth: 1,
    borderColor: "#e0ddeb",
    padding: 12,
  },
  codeLabel: {
    color: "#7a8090",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  codeText: {
    color: "#1a1a2e",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  videoLinkRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    backgroundColor: "#fbfcff",
    borderWidth: 1,
    borderColor: "#d8dce8",
    paddingHorizontal: 12,
  },
  videoLinkText: {
    flex: 1,
    minWidth: 0,
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "700",
  },
  inputLabel: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "800",
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d8dce8",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: "#fbfcff",
    outlineStyle: "none" as any,
  },
  getApprovedButton: {
    alignSelf: "flex-end",
    minHeight: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d3a52",
    paddingHorizontal: 14,
  },
  getApprovedButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  pendingText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
});

export default CreatorRequestsPage;
