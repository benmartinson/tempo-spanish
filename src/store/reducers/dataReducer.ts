import { RootState, DataAction, DataActionTypes } from '../../types';

const initialState: RootState = {

}

const dataReducer = (state: RootState = initialState, action: DataAction): RootState => {
  switch(action.type) {
    default:
    return state
  }
}

export default dataReducer;