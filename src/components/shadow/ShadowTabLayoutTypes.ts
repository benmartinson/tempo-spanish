import { ReactNode } from "react";

export interface ShadowTabLayoutProps {
  styles: Record<string, any>;
  errorBanner: ReactNode;
  mobileControls: ReactNode;
  countdownTimer: ReactNode;
  statusContent: ReactNode;
  streamBanner: ReactNode;
  contentTabs: ReactNode;
  recordingControls: ReactNode;
  sentenceNav: ReactNode;
  memorizeContent: ReactNode;
  playerControls: ReactNode;
  settingsButtons: ReactNode;
  overlays: ReactNode;
  isRecordingMode: boolean;
  showPracticeContent: boolean;
  isPlayerFullscreen?: boolean;
}
