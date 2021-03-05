/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from "react";
import { useSelector, useDispatch, shallowEqual } from "react-redux";

import { setCurrentTime } from "../../../app/dataBankSlice";

const PlaybackInterval = (props) => {
  const timeMode = useSelector(
    (state) => state.dataBank.timeMode,
    shallowEqual
  );
  const secondary_mode = useSelector(
    (state) => state.viewMode.mode.secondary_mode
  );

  useEffect(() => {
    if (secondary_mode !== "Real-time" && props.playback_state === "playing") {
      props.setPlaybackState("paused");
    }
  }, [secondary_mode]);

  const dispatch = useDispatch();

  function useInterval(callback, delay) {
    const savedCallback = useRef();
    // Remember the latest callback.
    useEffect(() => {
      savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
      function tick() {
        savedCallback.current();
      }
      if (delay !== null && props.playback_state === "playing") {
        const id = setInterval(tick, delay);
        return () => {
          clearInterval(id);
        };
      }
    }, [delay, props.playback_state]);
  }

  useInterval(() => {
    if (props.playback_state === "playing") {
      if (props.playback_speed === 0) {
        // Do nothing
      } else if (
        (props.playback_speed > 0 &&
          timeMode.current_timestamp_string !==
            timeMode.end_timestamp_string) ||
        (props.playback_speed < 0 &&
          timeMode.current_timestamp_string !== timeMode.start_timestamp_string)
      ) {
        const timedelta =
          props.playback_speed > 0
            ? timeMode.interval_minutes
            : -timeMode.interval_minutes;
        // For extra fast playback speed, speed 5 -> 2 * timedelta, speed 6 -> 3 * timedelta, speed 7 -> 4 * timedelta
        const timedelta_multiplier =
          Math.abs(props.playback_speed) > 4
            ? Math.abs(props.playback_speed) - 3
            : 1;
        dispatch(
          setCurrentTime({
            current_date: timeMode.current_timestamp_string,
            timedelta: timedelta * timedelta_multiplier,
          })
        );
      } else {
        if (props.playback_loop) {
          dispatch(
            setCurrentTime({
              current_date:
                props.playback_speed > 0
                  ? timeMode.start_timestamp_string
                  : timeMode.end_timestamp_string,
            })
          );
        } else {
          props.setPlaybackState("paused");
        }
      }
    }
  }, props.playback_interval_delay);
  return <></>;
};

export default PlaybackInterval;
