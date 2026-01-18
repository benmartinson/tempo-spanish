import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const BookCard = () => {
  return <View style={styles.container}>
    <Image source={require('../../assets/book1.jpg')} style={styles.coverImage}/>

    <View style={styles.detail}>
      <Text style={styles.bookName}>War of Worlds</Text>
      <Text style={styles.authorName}>HG Wells</Text>
      <Text style={styles.price}>$25</Text>
    </View>

    <View style={styles.deleteEditContainer}>
      <TouchableOpacity style={styles.circleButton}>
        <MaterialIcons name="delete-outline" size={24} color={"black"} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.circleButton}>
        <MaterialIcons name="edit" size={24} color={"black"} />
      </TouchableOpacity>
    </View>
  </View>
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: .1,
    shadowRadius: 4,
    elevation: 3,
    margin: 10
  },
  coverImage: {
    height: 120,
    width: "25%"
  },
  detail: {
    flex: 1,
    marginHorizontal: 10,
    marginTop: 10
  },
  bookName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000"
  },
  authorName: {
    fontSize: 14,
    color: "#888",
    marginVertical: 3
  },
  price: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#25A"
  },

  deleteEditContainer: {
    flexDirection: 'row',
    alignItems: "center"
  },
  circleButton: {
    height: 35,
    width: 35,
    borderRadius: 20,
    backgroundColor: "#eee",
    justifyContent: 'center',
    alignItems: 'center',
    marginStart: 10
  }
})

export default BookCard