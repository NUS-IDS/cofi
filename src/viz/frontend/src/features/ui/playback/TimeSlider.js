/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { useSelector, useDispatch, shallowEqual } from "react-redux";

import { format } from "date-fns";
import { scaleTime } from "d3-scale";

import { Slider, Rail, Handles, Tracks, Ticks } from "react-compound-slider";
import {
  SliderRail,
  Handle,
  Track,
  Tick,
} from "../../../helpers/sliderhelpers";

import { setCurrentTime } from "../../../app/dataBankSlice";
import { formatTimestampToString } from "../../../helpers/dataBankSlicehelpers";

// https://codesandbox.io/s/react-slider-histogram-forked-55fk6 Looks good!

const TimeSlider = () => {
  const timeMode = useSelector(
    (state) => state.dataBank.timeMode,
    shallowEqual
  );
  const secondary_mode = useSelector(
    (state) => state.viewMode.mode.secondary_mode,
    shallowEqual
  );
  const dispatch = useDispatch();

  const min = new Date(timeMode.start_timestamp_string);
  const max = new Date(timeMode.end_timestamp_string);

  /**
   * Dispatches current timestamp to Redux store whenever slider position is changed
   * @param {array} [ms]
   */
  const onChange = ([ms]) => {
    dispatch(
      setCurrentTime({ current_date: formatTimestampToString(new Date(ms)) })
    );
  };

  const sliderStyle = {
    position: "relative",
    width: "100%",
  };

  /**
   * Converts timestamp in unix milliseconds to truncated datestrings
   * (for labelling timeslider ticks)
   * @param {number} ms - timestamp in unix milliseconds
   * @returns {string} Truncated datestring
   */
  function formatTick(ms) {
    return format(new Date(ms), "dd/MM HH:mm");
  }

  /**
   * Prints out a large datetime in JSX
   * @param {Date} date
   * @returns {JSX}
   */
  const renderDateTime = (date) => {
    return (
      <div style={{ fontSize: 17, fontWeight: "bold", marginBottom: "1em" }}>
        {format(date, "eeee h:mm a dd MMM yyyy")}
      </div>
    );
  };

  /**
   * Generates datetime ticks based on start timestamp and end timestamp
   */
  const dateTicks = scaleTime()
    .domain([min, max])
    .ticks(8)
    .map((d) => +d);

  return (
    <div
      style={{
        position: "relative",
        textAlign: "center",
        fontFamily: "Arial",
        color: secondary_mode !== "Real-time" ? "rgb(40,40,40,0.8)" : "white",
        WebkitTextFillColor:
          secondary_mode !== "Real-time" ? "rgb(40,40,40,0.8)" : "white",
        WebkitTextStrokeWidth: "0px",
        WebkitTextStrokeColor:
          secondary_mode !== "Real-time" ? "rgb(40,40,40,0.8)" : "white",
        marginBottom: "3.5em",
      }}
    >
      {renderDateTime(new Date(timeMode.current_timestamp_string))}

      <Slider
        mode={1}
        step={1000 * 60 * timeMode.interval_minutes}
        domain={[+min, +max]}
        rootStyle={sliderStyle}
        onUpdate={onChange}
        onChange={onChange}
        values={[+new Date(timeMode.current_timestamp_string)]}
        disabled={secondary_mode !== "Real-time"}
      >
        <Rail>
          {({ getRailProps }) => (
            <SliderRail
              getRailProps={getRailProps}
              disabled={secondary_mode !== "Real-time"}
            />
          )}
        </Rail>
        <Handles>
          {({ handles, getHandleProps }) => (
            <div>
              {handles.map((handle) => (
                <Handle
                  key={handle.id}
                  handle={handle}
                  domain={[+min, +max]}
                  getHandleProps={getHandleProps}
                  disabled={secondary_mode !== "Real-time"}
                />
              ))}
            </div>
          )}
        </Handles>
        <Tracks right={false}>
          {({ tracks, getTrackProps }) => (
            <div>
              {tracks.map(({ id, source, target }) => (
                <Track
                  key={id}
                  source={source}
                  target={target}
                  getTrackProps={getTrackProps}
                  disabled={secondary_mode !== "Real-time"}
                />
              ))}
            </div>
          )}
        </Tracks>
        <Ticks values={dateTicks}>
          {({ ticks }) => (
            <div style={{ fontWeight: "bold" }}>
              {ticks.map((tick) => (
                <Tick
                  key={tick.id}
                  tick={tick}
                  count={ticks.length}
                  format={formatTick}
                  disabled={secondary_mode !== "Real-time"}
                />
              ))}
            </div>
          )}
        </Ticks>
      </Slider>
    </div>
  );
};

export default TimeSlider;
