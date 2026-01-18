import { StyleSheet } from 'react-native'
import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import CardSwiper from './CardSwiper'

const HomeScreen: React.FC = () => {
  return (
    <GestureHandlerRootView style={styles.container}>
      <CardSwiper />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

export default HomeScreen