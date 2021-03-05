import { createSlice } from "@reduxjs/toolkit";

/**
 * Converts color scale instructions to MapboxGL data-driven styling instructions
 * @param {*} scale - Array of color scale instructions
 * @returns {array} - MapboxGL data-driven styling instructions
 */
function scaleToFeatureStateStyling(scale, feature_state) {
  const arrays = scale.map((x) => [
    [x[0], ["feature-state", feature_state], x[1]],
    x[2],
  ]);
  return [].concat.apply([], arrays);
}

const session_count_density_scale = [
  ["==", 0, "#d3d3d3"],
  ["<", 0.0001, "#440154", 0.00001],
  ["<", 0.001, "#404788", 0.0001],
  ["<", 0.01, "#1f968b", 0.001],
  ["<", 0.1, "#55c667", 0.01],
  ["<", 1, "#fde725", 0.1],
  [">=", 1, "orange"],
];
const session_count_scale = [
  ["==", 0, "#d3d3d3"],
  ["<", 2, "#440154", 1],
  ["<", 4, "#404788", 2],
  ["<", 6, "#1f968b", 4],
  ["<", 8, "#7bccc4", 6],
  ["<", 10, "#55c667", 8],
  ["<", 15, "#fde725", 10],
  [">=", 15, "orange"],
];
// 1, 3, 10, 25, 70, 165
// 0.1, 0.5, 1.5, 5, 10, 27
const outbreak_scale = [
  ["==", 0, "#d3d3d3"],
  ["<", 0.5, "#440154", 0.1],
  ["<", 1.5, "#404788", 0.5],
  ["<", 5, "#1f968b", 1.5],
  ["<", 10, "#55c667", 5],
  ["<", 27, "#fde725", 10],
  [">=", 27, "orange"],
];
const scds = scaleToFeatureStateStyling(
  session_count_density_scale,
  "session_count_density",
  "range"
);
const scs = scaleToFeatureStateStyling(
  session_count_scale,
  "session_count",
  "range"
);
const obs = scaleToFeatureStateStyling(
  outbreak_scale,
  "session_count",
  "range"
);

const initialState = {
  lighting: false,
  sky: true,
  session_count_density_scale,
  session_count_scale,
  outbreak_scale,
  legend: {
    "fill-extrusion-vertical-gradient": true,
    "fill-extrusion-base": ["get", "base_height"],
    "fill-extrusion-height": ["get", "height"],
    "fill-extrusion-opacity": 0.8,
    "fill-extrusion-color": [
      "case",
      ["boolean", ["feature-state", "hover"], true],
      "#FF00FF",
      ["boolean", ["feature-state", "density"], true],
      [
        "case",
        ["==", ["feature-state", "session_count"], -1],
        "black",
        ...scds,
        "white",
      ],
      ["==", ["feature-state", "primary_mode"], "Outbreak Simulation"],
      [
        "case",
        ["==", ["feature-state", "session_count"], -1],
        "black",
        ...obs,
        "white",
      ],
      [
        "case",
        ["==", ["feature-state", "session_count"], -1],
        "black",
        ...scs,
        "white",
      ],
    ],
  },
  skybox: {
    "sky-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0, 5, 0.3, 8, 1],
    "sky-atmosphere-color": "white",
    // set up the sky layer for atmospheric scattering
    "sky-type": "atmosphere",
    // explicitly set the position of the sun rather than allowing the sun to be attached to the main light source
    "sky-atmosphere-sun": [0, 0],
    // set the intensity of the sun as a light source (0-100 with higher values corresponding to brighter skies)
    "sky-atmosphere-sun-intensity": 5,
  },
};

export const mapStyleSlice = createSlice({
  name: "mapStyle",
  initialState,
  reducers: {
    setLegend(state, action) {
      state.legend = action.payload;
    },
    setSkybox(state, action) {
      const {
        sunAzimuth_mapbox,
        sunAltitude_mapbox,
        sun_intensity,
        sun_color,
      } = action.payload;
      state.skybox = {
        ...state.skybox,
        "sky-atmosphere-sun": [sunAzimuth_mapbox, sunAltitude_mapbox],
        "sky-atmosphere-sun-intensity": state.sky ? sun_intensity : 0,
        "sky-atmosphere-color": sun_color,
      };
    },
    setLighting(state, action) {
      state.lighting = action.payload;
    },
    setSky(state, action) {
      state.sky = action.payload;
    },
  },
});

export const {
  setLegend,
  setSkybox,
  setLighting,
  setSky,
} = mapStyleSlice.actions;
export default mapStyleSlice.reducer;
