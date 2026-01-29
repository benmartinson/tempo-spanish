import { Clip } from "../types";

export const WATCH_CLIPS: Clip[] = [
  {
    videoId: "DzyKH2DLCro",
    start: 0,
    end: 214,
  },
  {
    videoId: "4hGfVk0VAGA",
    start: 0,
    end: 214,
  },
];

// Mapping of video IDs to readable titles
export const VIDEO_TITLES: Record<string, string> = {
  DzyKH2DLCro: "Inglorious Basterds",
  "4hGfVk0VAGA": "Intermediate Spanish Dialogue",
};

// Helper function to get video title by ID
export const getVideoTitle = (videoId: string): string => {
  return VIDEO_TITLES[videoId] || `Video ${videoId}`;
};
