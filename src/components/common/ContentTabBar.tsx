import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
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
        </ScrollView>
      )}
      <View style={[styles.childrenWrapper, hidden && { display: 'none' }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    paddingTop: 0,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexGrow: 0,
  },
  tabBarContent: {
    flexDirection: "row",
    paddingRight: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#e0e0e0",
    marginLeft: -1,
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
  childrenWrapper: {
    flex: 1,
    maxWidth: 600,
    alignSelf: "center" as const,
    width: "100%",
    marginTop: Dimensions.get("window").width > 600 ? 16 : 0,
  },
});

export default ContentTabBar;
