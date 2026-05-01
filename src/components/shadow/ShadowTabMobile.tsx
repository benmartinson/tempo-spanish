import React from "react";
import { View } from "react-native";
import { ShadowTabLayoutProps } from "./ShadowTabLayoutTypes";

const ShadowTabMobile: React.FC<ShadowTabLayoutProps> = ({
  styles,
  errorBanner,
  sentenceNav,
  mobileControls,
  countdownTimer,
  statusContent,
  playRecordingButton,
  streamBanner,
  contentTabs,
  recordingControls,
  overlays,
}) => {
  return (
    <>
      <View style={styles.container}>
        {errorBanner}
        {sentenceNav}
        {mobileControls}
        {countdownTimer}
        <View style={styles.transcriptContainer}>
          {statusContent}
          {playRecordingButton}
          {streamBanner}
          {contentTabs}
        </View>
        {recordingControls}
      </View>
      {overlays}
    </>
  );
};

export default ShadowTabMobile;
