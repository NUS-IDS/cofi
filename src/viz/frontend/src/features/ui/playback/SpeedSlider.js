/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Slider from "@material-ui/core/Slider";
import { useSelector } from "react-redux";

const useStyles = makeStyles({
  root: {
    width: "15em",
    color: "#ffffff",
  },
  slider: {
    color: "cyan",
    "&.Mui-disabled": {
      color: "rgb(40,40,40,0.8)",
    },
  },
});

const SpeedSlider = ({
  maximum_speed_level,
  playback_speed,
  setPlaybackSpeed,
  setPlaybackState,
}) => {
  const secondary_mode = useSelector(
    (state) => state.viewMode.mode.secondary_mode
  );

  const handleSliderChange = (event, newValue) => {
    setPlaybackSpeed(newValue);
  };
  const handleSliderCommit = (event, newValue) => {
    // If user releases mouse button at playback speed 0
    // pause playback and set playback speed to 1
    if (newValue === 0) {
      setPlaybackState("paused");
      setPlaybackSpeed(1);
    }
  };

  const classes = useStyles();
  return (
    <div className={classes.root}>
      <Grid container spacing={2} alignItems="center">
        <Grid
          item
          style={{
            color:
              secondary_mode !== "Real-time" ? "rgb(40,40,40,0.8)" : "white",
          }}
        >
          Playback <br />
          Speed
        </Grid>
        <Grid item xs>
          <Slider
            className={classes.slider}
            style={
              secondary_mode !== "Real-time"
                ? { color: "rgb(40,40,40,0.8)" }
                : playback_speed === 0
                ? { color: "red" }
                : { color: "cyan" }
            }
            value={playback_speed}
            aria-labelledby="discrete-slider"
            valueLabelDisplay="off"
            step={1}
            //marks
            min={-maximum_speed_level}
            max={maximum_speed_level}
            onChange={handleSliderChange}
            onChangeCommitted={handleSliderCommit}
            disabled={secondary_mode !== "Real-time"}
          />
        </Grid>
        <Grid
          item
          style={{
            color:
              secondary_mode !== "Real-time" ? "rgb(40,40,40,0.8)" : "white",
          }}
        >
          {playback_speed}x
        </Grid>
      </Grid>
    </div>
  );
};
export default SpeedSlider;
