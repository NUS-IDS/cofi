import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { addMinutes } from "date-fns";
import {
  formatTimestampToString,
  datesAreOnSameDay,
  user_data_template,
  initialState,
} from "../helpers/dataBankSlicehelpers";
import {
  fetch_known_users,
  fetch_buildings_geojson,
  fetch_session_count_json,
  compute_contacted_session_count_json,
  compute_total_and_average_session_count_json,
  compute_user_trajectory,
  fetch_overlapping_sessions,
  fetch_simulation,
} from "../api/fetchData";

/*
status and error pattern guide
{
  status: 'obsolete' | 'loading' | 'up_to_date' | 'failed',
  error: string | null
}
*/

// Data retrieval method
const fetchKnownUsers = createAsyncThunk(
  "dataBank/fetchKnownUsers",
  async (obj = {}, { dispatch, getState }) => {
    const response = await fetch_known_users();
    return response;
  }
);
// Data retrieval method
const fetchBuildings = createAsyncThunk(
  "dataBank/fetchBuildings",
  async (obj = {}, { dispatch, getState }) => {
    const response = await fetch_buildings_geojson();
    return response;
  }
);
// Data retrieval method
const fetchSessionCounts = createAsyncThunk(
  "dataBank/fetchSessionCounts",
  async (obj = {}, { dispatch, getState }) => {
    const timeMode = getState().dataBank.timeMode;

    const realtime_counts = await fetch_session_count_json(
      timeMode.start_timestamp_string,
      timeMode.end_timestamp_string,
      timeMode.interval_minutes
    );
    const total_and_average = await compute_total_and_average_session_count_json(
      realtime_counts.session_count_json
    );

    return { realtime_counts, total_and_average };
  }
);
// Data retrieval method
const fetchUserSessionCounts = createAsyncThunk(
  "dataBank/fetchUserSessionCounts",
  async (obj = {}, { dispatch, getState }) => {
    const timeMode = getState().dataBank.timeMode;
    const userid_key = obj.userid_key;
    const response = await fetch_session_count_json(
      timeMode.start_timestamp_string,
      timeMode.end_timestamp_string,
      timeMode.interval_minutes,
      userid_key
    );

    return response;
  }
);
// Data retrieval method
const compute_user = createAsyncThunk(
  "dataBank/compute_user",
  async (obj = {}, { dispatch, getState }) => {
    const dataBank = getState().dataBank;
    const userid_key = obj.userid_key;
    const user_session_count_json =
      dataBank.usersByID[userid_key].user_session_count_json.data;
    const r = await Promise.all([
      compute_contacted_session_count_json(
        dataBank.sessionCountData.session_count_json,
        user_session_count_json
      ),
      compute_total_and_average_session_count_json(user_session_count_json),
      compute_user_trajectory(
        userid_key,
        user_session_count_json,
        dataBank.buildingData.layer_key_coordinates
      ),
    ]);
    return {
      contacted_session_count_json_realtime: r[0]["contacted_realtime"],
      contacted_session_count_json_cumulative: r[0]["contacted_cumulative"],
      total_session_count_json: [r[1][0]["total"], r[1][1]["total"]],
      average_session_count_json: [r[1][0]["average"], r[1][1]["average"]],
      userTimestampCoordinates: r[2],
    };
  }
);
// Data retrieval method
const fetchOverlappingSessions = createAsyncThunk(
  "dataBank/fetchOverlappingSessions",
  async (obj = {}, { dispatch, getState }) => {
    const start_timestamp = getState().dataBank.timeMode.start_timestamp_string;
    const end_timestamp = getState().dataBank.timeMode.end_timestamp_string;
    const userid_key = getState().dataBank.user.userid_key;
    const response = await fetch_overlapping_sessions(
      start_timestamp,
      end_timestamp,
      userid_key
    );
    return response;
  }
);
// Data retrieval method
export const fetchSimulation = createAsyncThunk(
  "dataBank/fetchSimulation",
  async (obj = {}, { dispatch, getState }) => {
    const params = obj;
    const start_timestamp = getState().dataBank.timeMode.start_timestamp_string;
    const end_timestamp = getState().dataBank.timeMode.end_timestamp_string;
    const interval_minutes = getState().dataBank.timeMode.interval_minutes;
    const response = await fetch_simulation(
      params,
      start_timestamp,
      end_timestamp,
      interval_minutes
    );
    return response;
  }
);

/**
 * Checks dataBank for any outdated parameters and dispatches data retrieval methods in sequence.
 *
 * @exports
 */
export const updateAllData = createAsyncThunk(
  "dataBank/updateAllData",
  async (obj = {}, { dispatch, getState }) => {
    const dataBank = getState().dataBank;

    const fetchAndComputeUserData = async (userid_key) => {
      await dispatch(fetchUserSessionCounts({ userid_key }));
      await dispatch(compute_user({ userid_key }));
    };

    if (dataBank.user.status !== "up_to_date") {
      await dispatch(fetchKnownUsers());
    }
    if (dataBank.buildingData.status !== "up_to_date") {
      await dispatch(fetchBuildings());
    }
    if (dataBank.sessionCountData.status !== "up_to_date") {
      await dispatch(fetchSessionCounts());
      // sessionCountData being outdated implies that userSessionCountData for all users is also outdated
      await Promise.all(
        Object.keys(dataBank.usersByID).map((userid_key) =>
          fetchAndComputeUserData(userid_key)
        )
      );
    } else if (dataBank.user.data_status !== "up_to_date") {
      // sessionCountData is up to date, but userSessionCountData
      // for current user is outdated, hence update current userid_key data only.
      const userid_key = dataBank.user.submitted_userid_key;
      await fetchAndComputeUserData(userid_key);
    }

    await dispatch(fetchOverlappingSessions());

    return;
  }
);

const loadStatusReducers = {
  setLoaded(state, action) {
    state.loadStatus.loaded = action.payload;
  },
  setLoadingMessage(state, action) {
    state.loadStatus.loadingMessage = action.payload;
  },
};

const timeModeReducers = {
  setStartAndEndTime(state, action) {
    // New start and end timestamps
    const new_start_timestamp_string = action.payload["start_date"];
    const new_end_timestamp_string = action.payload["end_date"];

    if (
      new_start_timestamp_string !== state.timeMode.start_timestamp_string ||
      new_end_timestamp_string !== state.timeMode.end_timestamp_string
    ) {
      // Time interval changed -> Flag obsolete data
      state.sessionCountData.status = "obsolete";
      state.user.data_status = "obsolete";
      state.overlappingSessionsData.status = "obsolete";
    }

    // Update start and end timestamps
    state.timeMode.start_timestamp_string = new_start_timestamp_string;
    state.timeMode.end_timestamp_string = new_end_timestamp_string;

    // If current timestamp lies beyond the new timestamp range, set it to the new start timestamp
    const startTimestamp = new Date(state.timeMode.start_timestamp_string);
    const endTimestamp = new Date(state.timeMode.end_timestamp_string);
    const currentTimestamp = new Date(state.timeMode.current_timestamp_string);
    if (currentTimestamp < startTimestamp || currentTimestamp > endTimestamp) {
      state.timeMode.current_timestamp_string =
        state.timeMode.start_timestamp_string;
    }
  },
  setCurrentTime(state, action) {
    const timeDelta = action.payload.timedelta ?? 0;
    const currentDate = addMinutes(
      new Date(action.payload.current_date),
      timeDelta
    );
    const currentStartDate = new Date(state.start_timestamp_string);
    const currentEndDate = new Date(state.end_timestamp_string);

    if (currentDate < currentStartDate) {
      // Attempted to set selected current timestamp <= current start timestamp
      // hence selected current timestamp will be automatically set to earliest possible timing
      state.timeMode.current_timestamp_string =
        state.timeMode.start_timestamp_string;
    } else if (currentDate > currentEndDate) {
      // Attempted to set selected current timestamp >= current end timestamp
      // hence selected current timestamp will be automatically set to latest possible timing
      state.timeMode.current_timestamp_string =
        state.timeMode.end_timestamp_string;
    } else {
      state.timeMode.current_timestamp_string = formatTimestampToString(
        currentDate
      );
    }
  },
  setIntervalMinutes(state, action) {
    const interval_minutes = action.payload;
    if (interval_minutes >= 1) {
      state.timeMode.interval_minutes = interval_minutes;
    }
  },
};

const userReducers = {
  setUserIdKey(state, action) {
    const { userid_key_input, mode = "" } = action.payload;
    if (!isNaN(+userid_key_input) && userid_key_input !== "") {
      if (!state.user.known_users.includes(+userid_key_input)) {
        // No such user, ignore input
      } else if (mode === "add user") {
        // Flag obsolete data if any
        state.user.data_status = "obsolete";
        state.overlappingSessionsData.status = "obsolete";
        state.loadStatus.loaded = false;
        state.user.submitted_userid_key = userid_key_input;
        state.usersByID[userid_key_input] = user_data_template;
      } else {
        state.user.userid_key = userid_key_input;
        state.overlappingSessionsData.status = "obsolete";
      }
    }
  },
  deleteUserIdKey(state, action) {
    // TODO: Implement deletion of userid
    console.log("TODO: deleteUserIdKey not yet implemented!");
  },
  toggleUserTrailVisibility(state, action) {
    const userid_key = action.payload;
    state.usersByID[userid_key].trail_visible = !state.usersByID[userid_key]
      .trail_visible;
  },
  toggleUserTrailColor(state, action) {
    const userid_key = action.payload;
    const currentIndex = state.colors.indexOf(
      state.usersByID[userid_key].trail_color
    );
    const newIndex =
      currentIndex === state.colors.length - 1 ? 0 : currentIndex + 1;
    state.usersByID[userid_key].trail_color = state.colors[newIndex];
  },
};

const simulationReducers = {
  submitParams(state, action) {
    state.simulationData.params = action.payload;
    state.simulationData.status = "obsolete";
  },
};

const knownUsersExtraReducers = {
  [fetchKnownUsers.pending]: (state, action) => {
    state.loadStatus.loadingMessage = `Identifying Known Users...`;
    state.user.status = "loading";
  },
  [fetchKnownUsers.fulfilled]: (state, action) => {
    state.user.status = "up_to_date";
    state.user.known_users = action.payload;
  },
  [fetchKnownUsers.rejected]: (state, action) => {
    state.user.status = "failed";
    state.user.error = action.error.message;
  },
};

const buildingDataExtraReducers = {
  [fetchBuildings.pending]: (state, action) => {
    state.loadStatus.loadingMessage = `Loading Building data...`;
    state.buildingData.status = "loading";
  },
  [fetchBuildings.fulfilled]: (state, action) => {
    const { response_json, layer_key_coordinates } = action.payload;
    state.buildingData.status = "up_to_date";
    state.buildingData.buildings_geojson = response_json;
    state.buildingData.layer_key_coordinates = layer_key_coordinates;
  },
  [fetchBuildings.rejected]: (state, action) => {
    state.buildingData.status = "failed";
    state.buildingData.error = action.error.message;
  },
};

const sessionCountDataExtraReducers = {
  [fetchSessionCounts.pending]: (state, action) => {
    state.loadStatus.loadingMessage = `Loading Session Count data for all users...`;
    state.sessionCountData.status = "loading";
  },
  [fetchSessionCounts.fulfilled]: (state, action) => {
    state.sessionCountData.status = "up_to_date";

    state.sessionCountData.session_count_json =
      action.payload.realtime_counts.session_count_json;

    state.sessionCountData.total_session_count_json[0] =
      action.payload.total_and_average[0]["total"];
    state.sessionCountData.total_session_count_json[1] =
      action.payload.total_and_average[1]["total"];

    state.sessionCountData.average_session_count_json[0] =
      action.payload.total_and_average[0]["average"];
    state.sessionCountData.average_session_count_json[1] =
      action.payload.total_and_average[1]["average"];
  },
  [fetchSessionCounts.rejected]: (state, action) => {
    state.sessionCountData.status = "failed";
    state.sessionCountData.error = action.error.message;
  },

  [fetchUserSessionCounts.pending]: (state, action) => {
    const userid_key = action.meta.arg.userid_key;
    state.loadStatus.loadingMessage = `Loading data for userid_key: ${userid_key}`;
    state.usersByID[userid_key].user_session_count_json.status = "loading";
  },
  [fetchUserSessionCounts.fulfilled]: (state, action) => {
    const { session_count_json, user_activity_status } = action.payload;
    const userid_key_details = state.usersByID[action.meta.arg.userid_key];
    userid_key_details.user_session_count_json.status = "up_to_date";
    userid_key_details.user_session_count_json.data = session_count_json;
    userid_key_details.user_activity_status = user_activity_status;
  },
  [fetchUserSessionCounts.rejected]: (state, action) => {
    const userid_key_details = state.usersByID[action.meta.arg.userid_key];
    userid_key_details.user_session_count_json.status = "failed";
    userid_key_details.user_session_count_json.error = action.error.message;
  },
};

const computeUserDataExtraReducers = {
  [compute_user.pending]: (state, action) => {
    const userid_key = action.meta.arg.userid_key;
    state.loadStatus.loadingMessage = `Performing computations`;
    state.usersByID[userid_key].compute_status = "loading";
  },
  [compute_user.fulfilled]: (state, action) => {
    const {
      userTimestampCoordinates,
      total_session_count_json,
      average_session_count_json,
      contacted_session_count_json_realtime,
      contacted_session_count_json_cumulative,
    } = action.payload;

    const userid_key_details = state.usersByID[action.meta.arg.userid_key];
    userid_key_details.compute_status = "up_to_date";
    userid_key_details.userTimestampCoordinates.data = userTimestampCoordinates;
    userid_key_details.total_session_count_json.data = total_session_count_json;
    userid_key_details.average_session_count_json.data = average_session_count_json;
    userid_key_details.contacted_session_count_json_realtime.data = contacted_session_count_json_realtime;
    userid_key_details.contacted_session_count_json_cumulative.data = contacted_session_count_json_cumulative;
  },
  [compute_user.rejected]: (state, action) => {
    const userid_key_details = state.usersByID[action.meta.arg.userid_key];
    userid_key_details.compute_status = "failed";
    userid_key_details.compute_error = action.error.message;
  },
};

const fetchOverlappingSessionsExtraReducers = {
  [fetchOverlappingSessions.pending]: (state, action) => {},
  [fetchOverlappingSessions.fulfilled]: (state, action) => {
    const overlapping_sessions = action.payload;
    state.overlappingSessionsData.data.overlaps = overlapping_sessions.overlaps;
    state.overlappingSessionsData.data.total_overlap_duration_per_userid =
      overlapping_sessions.total_overlap_duration_per_userid;
    state.overlappingSessionsData.status = "up_to_date";
  },
  [fetchOverlappingSessions.rejected]: (state, action) => {
    state.overlappingSessionsData.error = action.error.message;
  },
};

const fetchSimulationExtraReducers = {
  [fetchSimulation.pending]: (state, action) => {
    state.simulationData.status = "obsolete";
    state.loadStatus.loaded = false;
  },
  [fetchSimulation.fulfilled]: (state, action) => {
    const simulation_data = action.payload;
    state.simulationData.data = simulation_data;
    state.simulationData.status = "up_to_date";
    state.loadStatus.loaded = true;
  },
  [fetchSimulation.rejected]: (state, action) => {
    state.simulationData.error = action.error.message;
    state.loadStatus.loaded = true;
  },
};

const updateAllDataExtraReducers = {
  [updateAllData.pending]: (state, action) => {
    state.loadStatus.loaded = false;
  },
  [updateAllData.fulfilled]: (state, action) => {
    state.user.data_status = "up_to_date";
    // If a new userid_key has just been imported, set it as primary.
    if (state.user.submitted_userid_key !== null) {
      state.user.userid_key = state.user.submitted_userid_key;
    }
    state.user.submitted_userid_key = null;
    state.loadStatus.loaded = true;
  },
  [updateAllData.rejected]: (state, action) => {},
};

export const dataBankSlice = createSlice({
  name: "dataBank",
  initialState,
  reducers: {
    ...loadStatusReducers,
    ...timeModeReducers,
    ...userReducers,
    ...simulationReducers,
  },
  extraReducers: {
    ...knownUsersExtraReducers,
    ...buildingDataExtraReducers,
    ...sessionCountDataExtraReducers,
    ...computeUserDataExtraReducers,
    ...fetchOverlappingSessionsExtraReducers,
    ...fetchSimulationExtraReducers,
    ...updateAllDataExtraReducers,
  },
});

export const {
  setLoaded,
  setLoadingMessage,
  setStartAndEndTime,
  setCurrentTime,
  setIntervalMinutes,
  setUserIdKey,
  submitParams,
  deleteUserIdKey,
  toggleUserTrailVisibility,
  toggleUserTrailColor,
} = dataBankSlice.actions;
export default dataBankSlice.reducer;
