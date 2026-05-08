import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { backendFetch } from "../helpers/backendFetch";

type RealtimeEvent = {
  type?: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
};

type RealtimeSessionResponse = {
  client_secret: string;
  expires_at?: number;
  model?: string;
};

export interface UseRealtimeTranscriptionReturn {
  transcript: string;
  isConnected: boolean;
  isSupported: boolean;
  error: string | null;
  startRealtimeTranscription: (language?: string | null) => Promise<boolean>;
  stopRealtimeTranscription: () => Promise<string>;
  resetRealtimeTranscript: () => void;
}

const REALTIME_CALL_URL = "https://api.openai.com/v1/realtime/calls";

export const useRealtimeTranscription =
  (): UseRealtimeTranscriptionReturn => {
    const [transcript, setTranscript] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const peerConnectionRef = useRef<any>(null);
    const dataChannelRef = useRef<any>(null);
    const mediaStreamRef = useRef<any>(null);
    const itemOrderRef = useRef<string[]>([]);
    const completedItemsRef = useRef<Record<string, string>>({});
    const deltaItemsRef = useRef<Record<string, string>>({});
    const transcriptRef = useRef("");

    const isSupported = useMemo(() => {
      if (Platform.OS !== "web") return false;
      const g = globalThis as any;
      return Boolean(
        g.navigator?.mediaDevices?.getUserMedia && g.RTCPeerConnection,
      );
    }, []);

    const setTranscriptValue = useCallback((value: string) => {
      const normalized = value.replace(/\s+/g, " ").trim();
      transcriptRef.current = normalized;
      setTranscript(normalized);
    }, []);

    const rebuildTranscript = useCallback(() => {
      const orderedIds = itemOrderRef.current;
      const orderedText = orderedIds
        .map((id) => completedItemsRef.current[id] || deltaItemsRef.current[id])
        .filter(Boolean);

      const orphanDeltas = Object.entries(deltaItemsRef.current)
        .filter(([id]) => !orderedIds.includes(id))
        .map(([, text]) => text)
        .filter(Boolean);

      setTranscriptValue([...orderedText, ...orphanDeltas].join(" "));
    }, [setTranscriptValue]);

    const rememberItem = useCallback((itemId: string) => {
      if (!itemOrderRef.current.includes(itemId)) {
        itemOrderRef.current.push(itemId);
      }
    }, []);

    const resetRealtimeTranscript = useCallback(() => {
      itemOrderRef.current = [];
      completedItemsRef.current = {};
      deltaItemsRef.current = {};
      setTranscriptValue("");
      setError(null);
    }, [setTranscriptValue]);

    const closeConnection = useCallback(() => {
      const dc = dataChannelRef.current;
      if (dc) {
        try {
          dc.close();
        } catch {}
      }
      dataChannelRef.current = null;

      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          pc.close();
        } catch {}
      }
      peerConnectionRef.current = null;

      const stream = mediaStreamRef.current;
      if (stream) {
        try {
          stream.getTracks().forEach((track: any) => track.stop());
        } catch {}
      }
      mediaStreamRef.current = null;
      setIsConnected(false);
    }, []);

    const handleRealtimeEvent = useCallback(
      (event: RealtimeEvent) => {
        if (
          event.type === "conversation.item.input_audio_transcription.delta" &&
          event.item_id &&
          event.delta
        ) {
          rememberItem(event.item_id);
          deltaItemsRef.current[event.item_id] = `${
            deltaItemsRef.current[event.item_id] || ""
          }${event.delta}`;
          rebuildTranscript();
          return;
        }

        if (
          event.type ===
            "conversation.item.input_audio_transcription.completed" &&
          event.item_id
        ) {
          rememberItem(event.item_id);
          completedItemsRef.current[event.item_id] = event.transcript || "";
          delete deltaItemsRef.current[event.item_id];
          rebuildTranscript();
        }
      },
      [rebuildTranscript, rememberItem],
    );

    const startRealtimeTranscription = useCallback(async (language = "es") => {
      if (!isSupported) return false;

      closeConnection();
      resetRealtimeTranscript();
      const transcriptionLanguage = language || "es";

      try {
        const tokenResponse = await backendFetch(
          "/api/realtime-transcription/session",
          {
            method: "POST",
            body: JSON.stringify({ targetLanguage: transcriptionLanguage }),
          },
        );

        if (!tokenResponse.ok) {
          const body = await tokenResponse.text();
          throw new Error(
            `Realtime session failed: ${tokenResponse.status} - ${body}`,
          );
        }

        const session: RealtimeSessionResponse = await tokenResponse.json();
        const g = globalThis as any;
        const pc = new g.RTCPeerConnection();
        const stream = await g.navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        peerConnectionRef.current = pc;
        mediaStreamRef.current = stream;

        stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

        const dc = pc.createDataChannel("oai-events");
        dataChannelRef.current = dc;
        dc.addEventListener("open", () => setIsConnected(true));
        dc.addEventListener("close", () => setIsConnected(false));
        dc.addEventListener("message", (message: any) => {
          try {
            handleRealtimeEvent(JSON.parse(message.data));
          } catch (err) {
            console.warn("Unable to parse Realtime event", err);
          }
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(REALTIME_CALL_URL, {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${session.client_secret}`,
            "Content-Type": "application/sdp",
          },
        });

        if (!sdpResponse.ok) {
          const body = await sdpResponse.text();
          throw new Error(
            `Realtime call failed: ${sdpResponse.status} - ${body}`,
          );
        }

        await pc.setRemoteDescription({
          type: "answer",
          sdp: await sdpResponse.text(),
        });

        return true;
      } catch (err) {
        console.error("Realtime transcription error:", err);
        setError("Live transcription is unavailable");
        closeConnection();
        return false;
      }
    }, [
      closeConnection,
      handleRealtimeEvent,
      isSupported,
      resetRealtimeTranscript,
    ]);

    const stopRealtimeTranscription = useCallback(async () => {
      const stream = mediaStreamRef.current;
      if (stream) {
        try {
          stream.getTracks().forEach((track: any) => track.stop());
        } catch {}
      }

      // Give server VAD a short moment to send its final completed event.
      await new Promise((resolve) => setTimeout(resolve, 900));
      const finalTranscript = transcriptRef.current;
      closeConnection();
      return finalTranscript;
    }, [closeConnection]);

    useEffect(() => closeConnection, [closeConnection]);

    return {
      transcript,
      isConnected,
      isSupported,
      error,
      startRealtimeTranscription,
      stopRealtimeTranscription,
      resetRealtimeTranscript,
    };
  };
