import * as dateFns from "date-fns";
import * as d3 from "d3";

/**
 * Mimics [ _ for _ in range(start,stop,step) ] in Python
 * @exports
 * @param {number} start - Start of range interval
 * @param {number} stop - End of range interval
 * @param {number} step - Step size
 * @returns {Array} arr - An expanded range array (i.e. range(2,8,3) => [2,5,8])
 */
export const range = (start, stop, step) => {
  // the '+ 1' is to mimic php's inclusive behaviour https://stackoverflow.com/a/44957114
  return Array(Math.ceil((stop - start) / step) + 1)
    .fill(start)
    .map((x, y) => x + y * step);
};

/**
 * Fetches array of known userid_keys from database API
 * @exports
 * @returns {Array<Number>} response_json - Array of known userid_keys as integers
 */
export const fetch_known_users = async () => {
  try {
    const response = await fetch(`/api/users`);
    const response_json = await response.json();
    return response_json;
  } catch (error) {
    console.error(error);
    return { error };
  }
};

/**
 * Fetches both layered and non-layered buildings_geojson data from database API
 * @exports
 * @returns {{Object,Object}} {response_json,layer_key_coordinates} - building geojson, and
 * geospatial coordinates for each layer key (for layered and non-layered modes)
 */
export const fetch_buildings_geojson = async () => {
  try {
    const layered_modes = [0, 1];
    const urls = layered_modes.map(
      (mode) => `/api/buildings?layered=${mode}`
    );
    const get_buildings_geojson_for_mode = async (url) => {
      const response = await fetch(url);
      const response_json_for_mode = await response.json();
      let layer_key_coordinates_for_mode = {};
      for (const feature of response_json_for_mode["features"]) {
        const { layer_key, lon, lat, height } = feature["properties"];
        layer_key_coordinates_for_mode[layer_key] = [lon, lat, height];
      }
      return { response_json_for_mode, layer_key_coordinates_for_mode };
    };

    const datum = await Promise.all(
      urls.map((url) => get_buildings_geojson_for_mode(url))
    );
    const response_json = layered_modes.map(
      (mode) => datum[mode]["response_json_for_mode"]
    );
    const layer_key_coordinates = layered_modes.map(
      (mode) => datum[mode]["layer_key_coordinates_for_mode"]
    );

    return { response_json, layer_key_coordinates };
  } catch (error) {
    console.error(error);
    return { error };
  }
};

export const fetch_simulation = async (
  params,
  start_timestamp_string,
  end_timestamp_string,
  interval_minutes
) => {
  try {
    console.log(params)
    params["N"] = 10
    const session_counts = await d3.tsv(
      "/api/simulator",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      },
      function (d) {
        return {
          layer_key: d.layer_key,
          session_interval_start: +d.session_interval_start,
          session_count: +d.session_count,
        };
      }
    );

    // Create javascript object "buckets" with 'session_interval_start' as the key
    const viz_session_interval_start_timings = range(
      dateFns.getTime(new Date(start_timestamp_string)) / 1000,
      dateFns.getTime(new Date(end_timestamp_string)) / 1000,
      60 * interval_minutes
    );

    let sessionCountJSON = {};
    let sessionCountJSONCumulative = {};
    for (const viz_session_interval_start_timing of viz_session_interval_start_timings) {
      sessionCountJSON[viz_session_interval_start_timing] = {};
      sessionCountJSONCumulative[viz_session_interval_start_timing] = {};
    }
    // Put each session_count object into it's respective bucket
    session_counts.forEach((e) => {
      // Ignore datapoints that fall beyond visualisation time range
      if (
        viz_session_interval_start_timings.includes(e.session_interval_start)
      ) {
        sessionCountJSON[e.session_interval_start][e.layer_key] =
          e.session_count;
      }
    });

    for (const viz_session_interval_start_timing of viz_session_interval_start_timings) {
      if (
        viz_session_interval_start_timing ===
        viz_session_interval_start_timings[0]
      ) {
        sessionCountJSONCumulative[viz_session_interval_start_timing] = {
          ...sessionCountJSON[viz_session_interval_start_timing],
        };
      } else {
        sessionCountJSONCumulative[viz_session_interval_start_timing] = {
          ...sessionCountJSONCumulative[
            Number(viz_session_interval_start_timing) - 60 * interval_minutes
          ],
        };
        for (const [layer_key, count] of Object.entries(
          sessionCountJSON[viz_session_interval_start_timing]
        )) {
          if (
            sessionCountJSONCumulative[viz_session_interval_start_timing]?.[
              layer_key
            ] === undefined
          ) {
            sessionCountJSONCumulative[viz_session_interval_start_timing][
              layer_key
            ] = count;
          } else {
            sessionCountJSONCumulative[viz_session_interval_start_timing][
              layer_key
            ] += count;
          }
        }
      }
    }
    console.log(sessionCountJSON);
    console.log(sessionCountJSONCumulative);
    if (params["cumulative"] === "false") {
      return sessionCountJSON;
    } else {
      return sessionCountJSONCumulative;
    }
  } catch (error) {
    console.error(error);
    return { error };
  }
};

/**
 * Fetches both layered and non-layered session_count_json data from database API
 * within a start and end timestamp
 * If userid_key is not "false", this function fetches the user's session counts instead.
 * @exports
 * @param {string} start_timestamp_string - Starting timestamp
 * @param {string} end_timestamp_string - Ending timestamp
 * @param {number} interval_minutes - Time interval between sessions (in minutes)
 * @param {string} userid_key - Current user's userid_key
 * @returns {Object} sessionCountJSON - Session Count data (for layered and non-layered modes)
 */
export const fetch_session_count_json = async (
  start_timestamp_string,
  end_timestamp_string,
  interval_minutes,
  userid_key = "false"
) => {
  const layered_modes = [0, 1];
  const urls = layered_modes.map(
    (mode) =>
      `/api/session_counts?start_timestamp=${start_timestamp_string}\
    &end_timestamp=${end_timestamp_string}\
    &layered=${mode}\
    &userid_key=${userid_key}`
  );
  let user_activity_status = false;
  const getSessionCounts = async (url) => {
    const session_counts = await d3.tsv(url, function (d) {
      return {
        layer_key: d.layer_key,
        session_interval_start: +d.session_interval_start,
        session_count: +d.session_count,
      };
    });

    user_activity_status = userid_key !== "false" && session_counts.length > 0;
    // Create javascript object "buckets" with 'session_interval_start' as the key
    const session_interval_start_timings = range(
      dateFns.getTime(new Date(start_timestamp_string)) / 1000,
      dateFns.getTime(new Date(end_timestamp_string)) / 1000,
      60 * interval_minutes
    );

    let sessionCountJSON = {};
    for (const session_interval_start of session_interval_start_timings) {
      sessionCountJSON[session_interval_start] = {};
    }
    // Put each session_count object into it's respective bucket
    session_counts.forEach((e) => {
      sessionCountJSON[e.session_interval_start][e.layer_key] = e.session_count;
    });
    return sessionCountJSON;
  };

  try {
    const session_count_json = await Promise.all(
      urls.map((url) => getSessionCounts(url))
    );

    return { session_count_json, user_activity_status };
  } catch (error) {
    console.error(error);
    return { error };
  }
};

/**
 * Computes Session Counts at current user's location for every timestamp in user_session_count_json
 * (i.e. find out number of people in contact with current user at any given time)
 *
 * There are 2 modes, real-time and cumulative:
 *
 * In real-time mode, Session Counts for any given location and time are only recorded when current user is physically present.
 *
 * In cumulative mode, Session Counts for any given location and time
 * are continuously recorded as long as current user has visited that location at least once.
 * @exports
 * @param {Object} session_count_json - Session Count data for all users
 * @param {Object} user_session_count_json - Session Count data for current user
 * @returns {Object} { contacted_realtime, contacted_cumulative } -
 * Session Count data for real-time and cumulative modes (for layered and non-layered modes)
 *
 */
export const compute_contacted_session_count_json = async (
  session_count_json,
  user_session_count_json
) => {
  const layered_modes = [0, 1];
  const contacted_session_count_json = async (mode) => {
    let contacted_realtime = {};
    let contacted_cumulative = {};
    let visited_locations = new Set();
    for (const timestamp of Object.keys(user_session_count_json[mode])) {
      contacted_realtime[timestamp] = {};
      contacted_cumulative[timestamp] = {};
      for (const visited_location of Object.keys(
        user_session_count_json[mode][timestamp]
      )) {
        // Get location visited by current user at current timestamp,
        // set contacted sessions to be equal to total sessions at that timestamp and location.
        contacted_realtime[timestamp][visited_location] =
          session_count_json[mode][timestamp][visited_location];
        visited_locations.add(visited_location);
      }
      // When a previously visited location has 0 visitors, mark session_count as -1
      // so that it can still be indicated on the map
      for (const visited_location of visited_locations) {
        contacted_cumulative[timestamp][visited_location] = session_count_json[
          mode
        ][timestamp].hasOwnProperty(visited_location)
          ? session_count_json[mode][timestamp][visited_location]
          : -1;
      }
    }

    return { contacted_realtime, contacted_cumulative };
  };

  const contacted = await Promise.all(
    layered_modes.map((mode) => contacted_session_count_json(mode))
  );
  const contacted_realtime = contacted.map((r) => r["contacted_realtime"]);
  const contacted_cumulative = contacted.map((r) => r["contacted_cumulative"]);

  return { contacted_realtime, contacted_cumulative };
};

/**
 * Computes Total AND Average Session Counts accumulated at each location in time interval of (session_count_json OR user_session_count_json)
 * (i.e. session activity heatmap of (all users OR current user) for a given time interval)
 *
 * @exports
 * @param {Object} session_count_json - Session Count data for (all users OR current user)
 * @returns {Object} total_and_average - Total AND Average Session Count data accumulated at each location by (all users OR current user)
 * (for layered and non-layered modes)
 *
 */
export const compute_total_and_average_session_count_json = async (
  session_count_json
) => {
  const layered_modes = [0, 1];
  const total_and_average_session_count_json_for_mode = async (mode) => {
    let total_for_mode = {};
    const timestamps = Object.keys(session_count_json[mode]);
    for (const timestamp of timestamps) {
      for (const visited_location of Object.keys(
        session_count_json[mode][timestamp]
      )) {
        if (!total_for_mode.hasOwnProperty(visited_location)) {
          total_for_mode[visited_location] =
            session_count_json[mode][timestamp][visited_location];
        } else {
          total_for_mode[visited_location] +=
            session_count_json[mode][timestamp][visited_location];
        }
      }
    }

    let average_for_mode = {};
    const number_of_timestamps = timestamps.length;
    for (const location of Object.keys(total_for_mode)) {
      average_for_mode[location] =
        total_for_mode[location] / number_of_timestamps;
    }

    return {
      total: total_for_mode,
      average: average_for_mode,
    };
  };
  const total_and_average = await Promise.all(
    layered_modes.map((mode) =>
      total_and_average_session_count_json_for_mode(mode)
    )
  );
  return total_and_average;
};

/**
 * For each timestamp where user is active, create a datapoint containing
 * coordinates: User's visited location geospatial coordinates
 * timestamp: Current timestamp
 * previous_timestamps: A list of up to 15 most recent previous active timestamps
 *
 * Return these datapoints as an Object (for layered and non-layered modes)
 *
 * @exports
 * @param {string} userid_key - Current user's userid_key
 * @param {Object} user_session_count_json - Session Count data for current user
 * @param {Object} layer_key_coordinates - Geospatial coordinates for each layer key (for layered and non-layered modes)
 * @returns {Object} { trajectories } - Timestamp to layer_key mappings
 *
 */
export const compute_user_trajectory = async (
  userid_key,
  user_session_count_json,
  layer_key_coordinates
) => {
  const layered_modes = [0, 1];
  const user_trajectory_for_mode = async (mode) => {
    let trajectories_for_mode = { waypoints: [], userid_key: userid_key };
    let previous_timestamps = [];
    for (const timestamp of Object.keys(user_session_count_json[mode])) {
      // There should be only one layer_key per timestamp but sometimes there are multiple...
      // If there is at least one visited layer_key, pick it.
      const visited_layer_keys = Object.keys(
        user_session_count_json[mode][timestamp]
      );
      const layer_key =
        visited_layer_keys.length > 0 ? visited_layer_keys[0] : null;
      if (
        layer_key !== null &&
        layer_key_coordinates[mode][layer_key] !== undefined
      ) {
        trajectories_for_mode["waypoints"].push({
          coordinates: layer_key_coordinates[mode][layer_key],
          timestamp: Number(timestamp),
          previous_timestamps:
            previous_timestamps.length === 0 ? null : [...previous_timestamps],
        });
        previous_timestamps.push(Number(timestamp));
        // Show last 15 nodes on trail, to ensure comet trails remain visible
        if (previous_timestamps.length > 15) {
          previous_timestamps.shift();
        }
      }
    }

    return trajectories_for_mode;
  };

  const trajectories = await Promise.all(
    layered_modes.map((mode) => user_trajectory_for_mode(mode))
  );

  return trajectories;
};

export const fetch_overlapping_sessions = async (
  start_timestamp,
  end_timestamp,
  userid_key
) => {
  try {
    const response = await fetch(
      `/api/session_overlaps?start_timestamp=${start_timestamp}&end_timestamp=${end_timestamp}&userid_key=${userid_key}`
    );
    const overlapping_sessions = await response.json();
    return overlapping_sessions;
  } catch (error) {
    console.error(error);
    return { error };
  }
};
