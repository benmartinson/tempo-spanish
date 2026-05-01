import React from "react";
import { View } from "react-native";
import { ShadowTabLayoutProps } from "./ShadowTabLayoutTypes";

const ShadowTabWeb: React.FC<ShadowTabLayoutProps> = ({
  styles,
  errorBanner,
  countdownTimer,
  statusContent,
  playRecordingButton,
  streamBanner,
  memorizeContent,
  settingsButtons,
  sentenceNav,
  overlays,
  showPracticeContent,
}) => {
  return (
    <>
      <View style={styles.container}>
        <View style={styles.webSettingsButtonsOverlay}>{settingsButtons}</View>
        {statusContent && (
          <View style={styles.webStatusOverlay}>
            <View style={styles.webStatusOverlayContent}>
              {statusContent}
              {playRecordingButton}
            </View>
          </View>
        )}
        {errorBanner}
        {countdownTimer}
        <View style={styles.transcriptContainer}>
          {streamBanner}
          {showPracticeContent && (
            <View style={styles.webPracticeLayout}>
              <View style={styles.webPracticeSide} />
              <View style={styles.webMemorizeColumn}>{memorizeContent}</View>
              <View style={styles.webControlsColumn} />
            </View>
          )}
        </View>
        {sentenceNav}
      </View>
      {overlays}
    </>
  );
};

export default ShadowTabWeb;
