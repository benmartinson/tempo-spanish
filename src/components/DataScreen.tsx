import { View, Text } from 'react-native'
import React from 'react'
import BookCard from './BookCard'
import {useSelector} from 'react-redux';

const HomeScreen = () => {
  const totalLikes = useSelector(state => state.totalLikes);
  console.log({totalLikes})
  return (
    <View >
      <BookCard />
    </View>
  )
}

export default HomeScreen