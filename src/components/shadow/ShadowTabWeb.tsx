import React from "react";
import { View } from "react-native";
import { ShadowTabLayoutProps } from "./ShadowTabLayoutTypes";

const ShadowTabWeb: React.FC<ShadowTabLayoutProps> = ({
  styles,
  errorBanner,
  streamBanner,
  memorizeContent,
  settingsButtons,
  overlays,
  isPlayerFullscreen = false,
}) => {
  return (
    <>
      <View
        style={[
          styles.container,
          isPlayerFullscreen && styles.webFullscreenShadowRoot,
        ]}
      >
        {!isPlayerFullscreen && (
          <View style={styles.webSettingsButtonsOverlay}>
            {settingsButtons}
          </View>
        )}
        {errorBanner}
        <View style={styles.transcriptContainer}>
          {streamBanner}
          <View style={styles.webPracticeLayout}>
            <View style={styles.webPracticeSide} />
            <View style={styles.webMemorizeColumn}>{memorizeContent}</View>
            <View style={styles.webControlsColumn} />
          </View>
        </View>
      </View>
      {overlays}
    </>
  );
};

export default ShadowTabWeb;
