import { View, Text, StyleSheet } from "react-native";
import Fontisto from '@expo/vector-icons/Fontisto';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Entypo from '@expo/vector-icons/Entypo';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';




// Tab bar icon component
const TabIcon: React.FC<{ icon: string; label: string; focused: boolean }> = ({ icon, label, focused }) => {
  const iconColor = focused ? '#fff' : '#888';
  
  const iconComponent = (icon: string) => {
    switch (icon) {
      case 'home-outline':
        return <Ionicons name="home-outline" size={24} color={iconColor} />;
      case 'cycle':
        return <Entypo name="cycle" size={24} color={iconColor} />;
      case 'video-outline':
        return <SimpleLineIcons name="social-youtube" size={24} color={iconColor} />;
      case 'video-list':
        return <Feather name="list" size={24} color={iconColor} />;
      case 'chat-outline':
        return <MaterialCommunityIcons name="chat-outline" size={24} color={iconColor} />;
    }
  }
  return (
    <View style={styles.tabIconContainer}>
      <View style={styles.iconWrapper}>
        {iconComponent(icon)}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]} numberOfLines={1}>{label}</Text>
    </View>
  );
};


const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 70,
  },
  iconWrapper: {
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  tabLabelFocused: {
    color: '#fff',
  },
});

export default TabIcon;