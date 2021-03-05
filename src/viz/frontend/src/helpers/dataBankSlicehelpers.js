import * as dateFns from "date-fns";

/**
 * Converts Date object to timestamp string
 * @exports
 * @param {Date} timestamp - Date() object
 * @returns {Date} Timestamp string in "yyyy-MM-dd HH:mm:ss" format
 */
export const formatTimestampToString = (timestamp) =>
  dateFns.format(timestamp, "yyyy-MM-dd HH:mm:ss");

export const datesAreOnSameDay = (first, second) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

/*
Interesting userid_keys
21
646
2311
*/
const defaultUsers = ["31761", "2311"];

export const user_data_template = {
  user_activity_status: false,
  user_session_count_json: {
    data: [null, null],
    status: "obsolete",
    error: null,
  },
  compute_status: "obsolete",
  compute_error: null,
  userTimestampCoordinates: {
    data: [null, null],
  },
  total_session_count_json: {
    data: [null, null],
  },
  average_session_count_json: {
    data: [null, null],
  },
  contacted_session_count_json_realtime: {
    data: [null, null],
  },
  contacted_session_count_json_cumulative: {
    data: [null, null],
  },
  trail_color: "#d73027",
  trail_visible: true,
};

export const initialState = {
  loadStatus: { loaded: false, loadingMessage: "" },

  timeMode: {
    start_timestamp_string: "2020-01-06 06:00:00",
    end_timestamp_string: "2020-01-06 23:00:00",
    current_timestamp_string: "2020-01-06 15:00:00",
    interval_minutes: 15,
  },
  user: {
    userid_key: defaultUsers[0], // current view
    submitted_userid_key: defaultUsers[0], // latest userid_key submitted by user
    data_status: "obsolete",
    data_error: [],
    known_users: [],
    status: "obsolete", // This is for known users array only
    error: null, // This is for known users array only
  },
  buildingData: {
    buildings_geojson: [null, null],
    layer_key_coordinates: [null, null],
    status: "obsolete",
    error: null,
  },
  sessionCountData: {
    session_count_json: [null, null],
    total_session_count_json: [null, null],
    average_session_count_json: [null, null],
    status: "obsolete",
    error: null,
  },

  usersByID: Object.fromEntries(
    defaultUsers.map((x) => [x, user_data_template])
  ),

  overlappingSessionsData: {
    data: { overlaps: [], total_overlap_duration_per_userid: [] },
    status: "obsolete",
    error: null,
  },
  simulationData: {
    data: null,
    params: {
      model: "SIR",
      beta: "",
      theta: "",
      gamma: "",
      i0: "",
      start: "",
      end: "",
      T: "",
      save_interval: "",
      seed: "",
      N: "",
      cumulative: "false",
    },
    status: "up_to_date",
    error: null,
  },

  colors: ["#d73027", "#fc8d59", "#fee090", "#e0f3f8", "#91bfdb", "#4575b4"],
};
