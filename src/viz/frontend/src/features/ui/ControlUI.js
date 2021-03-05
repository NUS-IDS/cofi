/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Grid } from "@material-ui/core";
import TimeSlider from "./playback/TimeSlider";
import PlaybackInterval from "./playback/PlaybackInterval";
import PlaybackControls from "./playback/PlaybackControls";
import VizDisplayModes from "./VizDisplayModes";
import InputUser from "./InputUser";
import InputSimulation from "./InputSimulation";

const useStyles = makeStyles((theme) => ({
  root: {
    "& > *": {
      margin: theme.spacing(0.7),
    },
  },
  time_slider: {
    padding: "1vh 0 0 0",
  },
}));

const ControlUI = () => {
  const [playback_state, setPlaybackState] = useState("stopped");
  const [playback_speed, setPlaybackSpeed] = useState(1);
  const [playback_interval_delay, setPlaybackIntervalDelay] = useState(250);
  const [playback_loop, setPlaybackLoop] = useState(true);

  /**
   * Maps speed levels to time intervals
   * Format -> {speed_level:interval_ms}, where interval_ms is time in milliseconds between playback frames
   * Systems with weak CPUs/GPUs will have difficulty with playback where interval_ms is small.
   * Performance is found to be decent with an RTX 2060 GPU.
   * WebGL performance is better on Google Chrome 88 than Mozilla Firefox 85.
   */
  const speedIntervalMappings = {
    0: -1,
    1: 250,
    2: 125,
    3: 62.5,
    4: 31.25,
    5: 31.25,
    6: 31.25,
    7: 31.25,
    8: 31.25,
    9: 31.25,
    10: 31.25,
  };

  /**
   * Convenience function for returning the highest speed level in speedIntervalMappings
   */
  const maximum_speed_level = Math.max(
    ...Object.keys(speedIntervalMappings).map((x) => Number(x))
  );

  useEffect(() => {
    const newInterval = speedIntervalMappings[Math.abs(playback_speed)];
    setPlaybackIntervalDelay(newInterval);
  }, [playback_speed]);

  const classes = useStyles();
  return (
    <>
      <PlaybackInterval
        {...{
          setPlaybackState,
          playback_state,
          playback_interval_delay,
          playback_speed,
          playback_loop,
        }}
      />
      <div className={`${classes.root}`}>
        <Grid container>
          <Grid item xs={1} />
          <Grid item xs={10}>
            <TimeSlider />
          </Grid>
          <Grid item xs={1} />
          <Grid item xs={12}>
            <PlaybackControls
              {...{
                playback_state,
                setPlaybackState,
                setPlaybackSpeed,
                playback_loop,
                setPlaybackLoop,
                maximum_speed_level,
                playback_speed,
              }}
            />
          </Grid>
          <Grid item xs={4}>
            <VizDisplayModes />
          </Grid>
          <Grid item xs={8}>
            <InputUser />
          </Grid>
        </Grid>
      </div>
    </>
  );
};

export default ControlUI;
