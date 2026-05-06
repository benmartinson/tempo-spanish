import React from "react";
import { View } from "react-native";
import { createPortal } from "react-dom";
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
  const settingsButtonsPortal =
    !isPlayerFullscreen && typeof document !== "undefined"
      ? createPortal(
          <View style={styles.webSettingsButtonsOverlay}>
            {settingsButtons}
          </View>,
          document.body,
        )
      : null;

  return (
    <>
      <View
        style={[
          styles.container,
          isPlayerFullscreen && styles.webFullscreenShadowRoot,
        ]}
      >
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
      {settingsButtonsPortal}
      {overlays}
    </>
  );
};

export default ShadowTabWeb;
