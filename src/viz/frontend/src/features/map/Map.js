/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable import/no-webpack-loader-syntax */
import React, { useRef, useEffect, useState } from "react";
import { useSelector, useDispatch, shallowEqual } from "react-redux";

import mapboxgl from "mapbox-gl";
import MapGl, {
  Source,
  Layer,
  FlyToInterpolator,
  NavigationControl,
  WebMercatorViewport,
} from "react-map-gl";
import DeckGL from "deck.gl";
import { TripsLayer } from "@deck.gl/geo-layers";

import * as d3 from "d3";
import * as dateFns from "date-fns";

import {
  setHighlightedFeature,
  setHoverID,
  setHoverIDPersist,
  setViewport,
} from "../../app/viewModeSlice";
import { setSkybox } from "../../app/mapStyleSlice";

import {
  computeSunLightingParameters,
  snapToBearing,
} from "../../helpers/mapHelpers";

mapboxgl.workerClass = require("worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker").default;

const Map = () => {
  const loadStatus = useSelector(
    (state) => state.dataBank.loadStatus,
    shallowEqual
  );
  const timeMode = useSelector(
    (state) => state.dataBank.timeMode,
    shallowEqual
  );
  const viewMode = useSelector((state) => state.viewMode, shallowEqual);
  const mapStyle = useSelector((state) => state.mapStyle, shallowEqual);
  const user = useSelector((state) => state.dataBank.user, shallowEqual);
  const buildingData = useSelector(
    (state) => state.dataBank.buildingData,
    shallowEqual
  );
  const sessionCountData = useSelector(
    (state) => state.dataBank.sessionCountData,
    shallowEqual
  );
  const simulationData = useSelector(
    (state) => state.dataBank.simulationData,
    shallowEqual
  );
  const usersByID = useSelector(
    (state) => state.dataBank.usersByID,
    shallowEqual
  );

  const dispatch = useDispatch();

  const map = useRef(null);

  const [mapReady, setMapReady] = useState(false);

  // Mapbox access token
  mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

  const _onViewportChange = async (viewport) => {
    delete viewport.transitionInterpolator;
    delete viewport.transitionEasing;
    dispatch(setViewport(viewport));
  };

  const _onLoad = async (e) => {
    map.current = e.target;
    // When map is loaded, Toggle Map Ready Status,
    setMapReady(true);
  };

  const pick_session_count_json = async () => {
    let session_count_json;
    const is_layered = viewMode.layered ? 1 : 0;
    const userid_key = user.userid_key;
    const { primary_mode, secondary_mode } = viewMode.mode;

    if (primary_mode === "Crowd Density") {
      if (secondary_mode === "Real-time") {
        session_count_json = sessionCountData.session_count_json[is_layered];
      } else if (secondary_mode === "Average") {
        session_count_json =
          sessionCountData.average_session_count_json[is_layered];
      }
    } else if (primary_mode === "Track User Location") {
      if (secondary_mode === "Real-time") {
        session_count_json =
          usersByID[userid_key].contacted_session_count_json_realtime.data[
            is_layered
          ];
      } else if (
        secondary_mode ===
        "Total Time spent by Target User at each Building/Floor"
      ) {
        session_count_json =
          usersByID[userid_key].total_session_count_json.data[is_layered];
      }
    } else if (primary_mode === "Outbreak Simulation") {
      session_count_json = simulationData.data;
    }

    return session_count_json;
  };

  const update_map_highlight_state = async () => {
    if (viewMode.hover.previous_hoverID) {
      map.current.setFeatureState(
        {
          source: "buildings",
          id: viewMode.hover.previous_hoverID,
        },
        {
          hover: false,
        }
      );
    }
    if (viewMode.hover.hoverID) {
      map.current.setFeatureState(
        {
          source: "buildings",
          id: viewMode.hover.hoverID,
        },
        {
          hover: true,
        }
      );
    }
  };

  const update_map_lighting = async () => {
    // Set lighting effect based on time of day using SunCalc
    // This method works best for areas close to the equator, so we should be fine.

    // Get current timestamp's sun position for current map coordinate.
    const center = map.current.getCenter();
    const currentTime = new Date(timeMode.current_timestamp_string);

    const {
      sunAzimuth_mapbox,
      sunAltitude_mapbox,
      lightingSettings,
      sun_intensity,
      sun_color,
    } = computeSunLightingParameters(center, currentTime, mapStyle.lighting);
    // Update skybox sun position
    dispatch(
      setSkybox({
        sunAzimuth_mapbox,
        sunAltitude_mapbox,
        sun_intensity,
        sun_color,
      })
    );
    // Set building illumination
    map.current.setLight(lightingSettings);
  };

  const update_map_state = async () => {
    const session_count_json = await pick_session_count_json();

    // Seconds elapsed since start_timestamp
    const seconds_elapsed =
      dateFns.getTime(new Date(timeMode.current_timestamp_string)) / 1000;
    // Get session counts for each building at time = seconds_elapsed since start_timestamp
    let current_sessions;
    // If no simulation data has been loaded yet
    if (session_count_json !== null) {
      current_sessions = [
        "Total Time spent by Target User at each Building/Floor",
        "Average",
      ].includes(viewMode.mode.secondary_mode)
        ? session_count_json
        : session_count_json[seconds_elapsed];
    } else {
      current_sessions = {};
    }

    // Update feature state for each layer_key with its session_count. If no data available, assume session_count of zero.
    for (const building of buildingData.buildings_geojson[
      viewMode.layered ? 1 : 0
    ].features) {
      const {
        key,
        layer_key,
        area,
        floor,
        lon,
        lat,
        description,
      } = building.properties;

      const floor_area = viewMode.layered ? area : area * floor;
      // if current sessions are available and the building layer_key matches, set the session count, otherwise set it as zero.
      const session_count = current_sessions?.[
        viewMode.mode.primary_mode === "Outbreak Simulation"
          ? layer_key.split(" ")[0] + " 1"
          : layer_key
      ]
        ? current_sessions[
            viewMode.mode.primary_mode === "Outbreak Simulation"
              ? layer_key.split(" ")[0] + " 1"
              : layer_key
          ]
        : 0; // TODO IMPROVEMENTS LATER: Dirty hack for simulation layer key always having floor 1, need to change later
      // https://www.moh.gov.sg/news-highlights/details/tighter-measures-to-minimise-further-spread-of-covid-19
      // Safe distancing; 1 person per 16 sqm
      const session_count_density =
        session_count === 0 || session_count === -1
          ? 0
          : Math.round(((session_count * 100000.0) / floor_area) * 16) / 100000;

      const highlight_status = layer_key === viewMode.hover.hoverID;
      if (highlight_status) {
        // Update highlighted feature description
        const properties = { key, floor, area, lon, lat, description };
        const state = { session_count, session_count_density };
        dispatch(setHighlightedFeature({ properties, state }));
      }

      // Update feature state for this layer_key
      map.current.setFeatureState(
        {
          source: "buildings",
          id: layer_key,
        },
        {
          session_count,
          session_count_density,
          hover: highlight_status,
          density: viewMode.density,
          layered_mode: viewMode.layered,
          primary_mode: viewMode.mode.primary_mode,
        }
      );
    }
  };

  useEffect(() => {
    if (mapReady && loadStatus.loaded) {
      update_map_highlight_state();
    }
  }, [viewMode.hover.hoverID, mapReady, loadStatus.loaded]);

  useEffect(() => {
    if (mapReady && loadStatus.loaded) {
      update_map_state();
      update_map_lighting();
    }
  }, [
    viewMode.mode,
    viewMode.layered,
    viewMode.density,
    sessionCountData.session_count_json,
    timeMode.current_timestamp_string,
    usersByID[user.userid_key].total_session_count_json.data,
    usersByID[user.userid_key].average_session_count_json.data,
    simulationData.data,
    mapReady,
    loadStatus.loaded,
  ]);

  useEffect(() => {
    if (mapReady && loadStatus.loaded) {
      update_map_lighting();
    }
  }, [mapStyle.lighting, mapStyle.sky, mapReady, loadStatus.loaded]);

  const _onClick = async (e) => {
    // Fly camera view to clicked buildings
    if (e.leftButton && e.features.length && !viewMode.hover.hoverIDPersist) {
      const feature = e.features[0];
      const { properties, state } = feature;
      // Get properties of first feature detected by click
      const { lon, lat } = properties;
      dispatch(setHighlightedFeature({ properties, state }));
      dispatch(setHoverID(feature.id));
      dispatch(setHoverIDPersist(true));
      dispatch(
        setViewport({
          ...viewMode.viewport,
          longitude: lon,
          latitude: lat,
          zoom: 18,
          pitch: 55,
          bearing: snapToBearing(viewMode.viewport.bearing),
          transitionDuration: 300,
          transitionInterpolator: new FlyToInterpolator(),
          transitionEasing: d3.easeCubicOut,
        })
      );
    }
  };

  const _onMouseMove = async (e) => {
    if (!viewMode.hover.hoverIDPersist) {
      // Highlight building polygons on cursor hover
      const features =
        map.current
          ?.getStyle()
          .layers.some((elem) => elem["id"] === "buildings") === true
          ? map.current?.queryRenderedFeatures(e.point, {
              layers: ["buildings"],
              validate: false,
            })
          : [];
      if (features?.[0]) {
        // if hovering over a feature
        const feature = features[0];
        const { properties, state } = feature;
        if (feature.id !== viewMode.hover.hoverID) {
          // check if hovering over same feature found on previous _onMouseMove
          dispatch(setHighlightedFeature({ properties, state }));
          dispatch(setHoverID(feature.id));
        }
      } else if (viewMode.hover.hoverID !== null) {
        // Not hovering over any feature, set hovered feature to null if not already null
        dispatch(setHighlightedFeature(null));
        dispatch(setHoverID(null));
      }
    }
  };

  const _onMouseOut = async () => {
    if (!viewMode.hover.hoverIDPersist) {
      dispatch(setHighlightedFeature(null));
      dispatch(setHoverID(null));
    }
  };

  const getTrailLength = () => {
    if (viewMode.individual_heatmap) {
      return 31536000; // Number of seconds in 1 year
    } else {
      const last_visited_node = usersByID[
        user.userid_key
      ].userTimestampCoordinates.data[viewMode.layered ? 1 : 0].waypoints
        .filter(
          (x) =>
            x.timestamp <
            dateFns.getTime(new Date(timeMode.current_timestamp_string)) / 1000
        )
        ?.slice(-1)[0];

      return last_visited_node?.timestamp
        ? dateFns.getTime(new Date(timeMode.current_timestamp_string)) / 1000 -
            last_visited_node.timestamp
        : 0;
    }
  };

  return (
    <div>
      <MapGl
        mapStyle="mapbox://styles/mapbox/dark-v10?optimize=true"
        onViewportChange={_onViewportChange}
        onLoad={_onLoad}
        mapOptions={{ hash: true, antialias: true, logoPosition: "top-left" }}
        interactiveLayerIds={["buildings"]}
        onClick={_onClick}
        onMouseMove={_onMouseMove}
        onMouseOut={_onMouseOut}
        scrollZoom={{ smooth: true }}
        asyncRender={true}
        mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_ACCESS_TOKEN}
        {...viewMode.viewport}
      >
        <Source
          id="buildings"
          type="geojson"
          data={buildingData.buildings_geojson[viewMode.layered ? 1 : 0]}
          promoteId="layer_key"
          tolerance={0.5}
          buffer={64}
        >
          {/* Session_count chloropleth map layer */}
          {/* See https://colorbrewer2.org/#type=sequential&scheme=YlOrRd&n=9  */}
          <Layer
            id="buildings"
            type="fill-extrusion"
            source="buildings"
            paint={mapStyle.legend}
            layout={{ visibility: loadStatus.loaded ? "visible" : "none" }}
          />
          <Layer id="sky" type="sky" paint={mapStyle.skybox} />
        </Source>
        {/* How to get DeckGL to inherit cursor styles from ReactMapGl https://github.com/visgl/deck.gl/issues/2220 */}
        <DeckGL viewState={viewMode.viewport} getCursor={() => "inherit"}>
          {loadStatus.loaded ? (
            <TripsLayer
              visible={viewMode.trajectories}
              id="trips"
              data={[
                usersByID[user.userid_key].userTimestampCoordinates.data[
                  viewMode.layered ? 1 : 0
                ],
              ]}
              getWidth={2}
              getPath={(d) => d.waypoints.map((p) => p.coordinates)}
              getTimestamps={(d) =>
                d.waypoints.map(
                  (p) =>
                    p.timestamp -
                    dateFns.getTime(new Date(timeMode.start_timestamp_string)) /
                      1000
                )
              }
              getColor={[239, 124, 0]}
              opacity={0.8}
              widthMinPixels={5}
              rounded={true}
              trailLength={getTrailLength()}
              currentTime={
                dateFns.getTime(new Date(timeMode.current_timestamp_string)) /
                  1000 -
                dateFns.getTime(new Date(timeMode.start_timestamp_string)) /
                  1000
              }
              billboard={true}
            />
          ) : (
            ""
          )}

          <div style={{ position: "absolute", right: 0, bottom: "2vh" }}>
            <NavigationControl />
          </div>
        </DeckGL>
      </MapGl>
    </div>
  );
};
export default Map;
