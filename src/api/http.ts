import axios from "axios";
import { Alert } from "react-native";

const endpointURL = "https://6755c1d011ce847c992b1144.mockapi.io/books";

const getListOfBooks = async () => {
  try {
    const response = await axios.get(endpointURL);
    console.log(JSON.stringify(response.data, null));
    setBookList(response.data);
  } catch (error) {
    console.log(error);
  }
};

const getBookByID = async () => {
  try {
    const response = await axios.get(`${endpointURL}/5`);
    console.log(JSON.stringify(response.data, null, 3));
  } catch (error) {
    console.log("An Error Occurred", error);
  }
};

const deleteBookByID = async() => {
  try {
    const response = await axios.delete(`${endpointURL}/3`)
    Alert.alert("Book Is Deleted Successfully")
  } catch (error) {
    console.log(error)
  }
}


const body = {
  name_of_author: "Angel",
  cover: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR53zC4cpDSR6-1QvFkRaC5M5_cWn3m76I0mA&s",
  price_of_book: 99,
  email_of_seller: "angel@hotmail.com",
}

const createBook = async() => {
  try {
    const response = await axios.post(endpointURL, body)

    Alert.alert("Book Has Been Created!")
    getListOfBooks()
  } catch (error) {
    console.log(error)
  }
}

const updateBook = async() => {
  try {
    const response = await axios.put(`${endpointURL}/8`, body)

    Alert.alert("Book Has Been Updated!")
    getListOfBooks()
  } catch (error) {
    console.log(error)
  }
}