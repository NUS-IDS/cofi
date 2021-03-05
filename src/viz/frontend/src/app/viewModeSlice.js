import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  mode: { primary_mode: "Crowd Density", secondary_mode: "Real-time" },
  layered: true,
  density: true,
  trajectories: false,
  hover: {
    hoverIDPersist: false,
    hoverID: null,
    previous_hoverID: null,
    key: null,
    floor: null,
    area: null,
    session_count: null,
    session_count_density: null,
    average_floor_area: null,
    lon: null,
    lat: null,
    description: null,
  },
  viewport: {
    width: "100%",
    height: "100%",
    longitude: 103.776,
    latitude: 1.29908,
    zoom: 15.96,
    pitch: 85,
    bearing: 0,
    minZoom: 14,
  },
  display_modes: [
    ["Crowd Density", "Real-time"],
    ["Crowd Density", "Average"],
    ["Track User Location", "Real-time"],
    [
      "Track User Location",
      "Total Time spent by Target User at each Building/Floor",
    ],
    ["Outbreak Simulation", "Real-time"],
  ],
};

export const viewModeSlice = createSlice({
  name: "viewMode",
  initialState,
  reducers: {
    setMode(state, action) {
      state.mode = action.payload;
      const { primary_mode, secondary_mode } = state.mode;
      const mode_to_settings_mappings = {
        "Crowd Density": {
          "Real-time": { d: true, t: false },
          Average: { d: true, t: false },
        },
        "Track User Location": {
          "Real-time": { d: false, t: true },
          "Total Time spent by Target User at each Building/Floor": {
            d: false,
            t: false,
          },
        },
        "Outbreak Simulation": {
          "Real-time": { d: false, t: false },
        },
      };
      const { d, t } = mode_to_settings_mappings[primary_mode][secondary_mode];
      [state.density, state.trajectories] = [d, t];
      // Only non-layered mode allowed for Outbreak Simulation
      if (primary_mode === "Outbreak Simulation") {
        state.layered = false;
      }
    },
    setLayered(state, action) {
      state.layered = action.payload;
      state.hover.hoverIDPersist = false;
      state.hover.hoverID = null;
    },

    setHighlightedFeature(state, action) {
      if (action.payload) {
        const {
          key,
          floor,
          area,
          lon,
          lat,
          description,
        } = action.payload.properties;
        const { session_count, session_count_density } = action.payload.state;
        const average_floor_area = Math.round(area * 1.0);
        state.hover = {
          ...state.hover,
          key,
          floor,
          area,
          session_count,
          session_count_density,
          average_floor_area,
          lon,
          lat,
          description,
        };
      } else {
        state.hover.previous_hoverID = state.hover.hoverID;
        state.hover.hoverID = null;
      }
    },
    setHoverID(state, action) {
      state.hover.previous_hoverID = state.hover.hoverID;
      state.hover.hoverID = action.payload;
    },
    setHoverIDPersist(state, action) {
      state.hover.hoverIDPersist = action.payload;
    },
    setViewport(state, action) {
      const viewport = action.payload;
      // Restrict Longitude coordinates
      viewport.longitude = Math.min(
        Math.max(viewport.longitude, 103.758),
        103.828
      );
      // Restrict Latitude coordinates
      viewport.latitude = Math.min(Math.max(viewport.latitude, 1.24), 1.33);
      state.viewport = viewport;

      // When viewport pitch is 2 degrees or less, toggle enable non-layered mode
      if (viewport.pitch <= 2) {
        state.layered = false;
      }
    },
  },
});
export const {
  setMode,
  setLayered,
  setDensity,
  setTrajectories,
  setHighlightedFeature,
  setHoverID,
  setHoverIDPersist,
  setViewport,
} = viewModeSlice.actions;
export default viewModeSlice.reducer;
