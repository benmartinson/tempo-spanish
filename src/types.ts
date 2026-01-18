export interface Card {
  id: string;
  clip: Clip;
}

export interface RootState {
}

export type DataActionTypes = '';

export interface DataAction {
  type: DataActionTypes;
}


export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

export interface Clip {
  videoId: string;
  start: number;
  end: number;
}