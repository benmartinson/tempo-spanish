import React from "react";
import { View } from "react-native";
import { createPortal } from "react-dom";
import { ShadowTabLayoutProps } from "./ShadowTabLayoutTypes";

const ShadowTabWeb: React.FC<ShadowTabLayoutProps> = ({
  styles,
  errorBanner,
  streamBanner,
  contentTabs,
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
        <View style={{ justifyContent: "center" }}>{errorBanner}</View>
        <View style={styles.transcriptContainer}>
          {streamBanner}
          <View style={styles.webPracticeLayout}>
            <View style={styles.webPracticeSide} />
            <View style={styles.webMemorizeColumn}>{contentTabs}</View>
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
