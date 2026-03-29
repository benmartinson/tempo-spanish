import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export interface TabDefinition {
  key: string;
  label: string;
}

interface ContentTabBarProps {
  tabs: TabDefinition[];
  selectedTab: string;
  onSelectTab: (key: string) => void;
  hidden?: boolean;
  children: React.ReactNode;
}

const ContentTabBar: React.FC<ContentTabBarProps> = ({
  tabs,
  selectedTab,
  onSelectTab,
  hidden,
  children,
}) => {
  return (
    <View style={styles.container}>
      {!hidden && (
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, selectedTab === tab.key && styles.tabActive]}
              onPress={() => onSelectTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    paddingTop: 0,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "transparent",
  },
  tabActive: {
    backgroundColor: "#fff",
    borderColor: "#e0e0e0",
    borderBottomWidth: 0,
    marginBottom: -1,
    paddingBottom: 9,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
  },
  tabTextActive: {
    color: "#333",
  },
});

export default ContentTabBar;
