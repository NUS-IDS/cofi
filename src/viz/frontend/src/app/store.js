import { configureStore } from "@reduxjs/toolkit";

import dataBankReducer from "./dataBankSlice";
import mapStyleReducer from "./mapStyleSlice";
import viewModeReducer from "./viewModeSlice";

// Thunk middleware allows us to write async logic that interacts with the Redux store
import thunk from "redux-thunk";

const store = configureStore({
  reducer: {
    dataBank: dataBankReducer,
    mapStyle: mapStyleReducer,
    viewMode: viewModeReducer,
  },
  middleware: [thunk],
});

export default store;
