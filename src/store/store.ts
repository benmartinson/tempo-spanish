import { createStore } from "redux";
import { RootState, DataAction } from '../types';
import dataReducer from "./reducers/dataReducer";

const store = createStore<RootState, DataAction, any, any>(dataReducer);

export default store;