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
  playerControls,
  settingsButtons,
  sentenceNav,
  overlays,
  isRecordingMode,
  showPracticeContent,
}) => {
  return (
    <>
      <View style={styles.container}>
        <View style={styles.webSettingsButtonsOverlay}>{settingsButtons}</View>
        {errorBanner}
        {countdownTimer}
        <View style={styles.transcriptContainer}>
          {statusContent}
          {playRecordingButton}
          {streamBanner}
          {showPracticeContent && (
            <View style={styles.webPracticeLayout}>
              <View style={styles.webPracticeSide} />
              <View style={styles.webMemorizeColumn}>{memorizeContent}</View>
              <View style={styles.webControlsColumn}>
                {!isRecordingMode && playerControls}
              </View>
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
