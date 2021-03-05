/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { useSelector, useDispatch, shallowEqual } from "react-redux";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import { ButtonGroup, Grid } from "@material-ui/core";

import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import PauseIcon from "@material-ui/icons/Pause";
import StopIcon from "@material-ui/icons/Stop";
import SkipPreviousIcon from "@material-ui/icons/SkipPrevious";
import SkipNextIcon from "@material-ui/icons/SkipNext";
import ArrowForwardIosIcon from "@material-ui/icons/ArrowForwardIos";
import ArrowBackIosIcon from "@material-ui/icons/ArrowBackIos";
import RepeatIcon from "@material-ui/icons/Repeat";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import CloudIcon from "@material-ui/icons/Cloud";
import LayersIcon from "@material-ui/icons/Layers";

import { setCurrentTime } from "../../../app/dataBankSlice";
import { setLighting, setSky } from "../../../app/mapStyleSlice";
import { setLayered } from "../../../app/viewModeSlice";
import InputTimeRange from "../InputTimeRange";
import SpeedSlider from "./SpeedSlider";
import CameraShortcuts from "../camera/CameraShortcuts";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  playback_control_button: {
    backgroundColor: "#e3f2fd",
    "&:hover": {
      backgroundColor: "white",
    },
    "&.Mui-disabled": {
      background: "rgb(40,40,40,0.8)",
    },
  },
  toggle_button_enabled: {
    backgroundColor: "cyan",
    "&:hover": {
      backgroundColor: "cyan",
    },
    "&.Mui-disabled": {
      background: "rgb(40,40,40,0.8)",
    },
  },
  toggle_button_disabled: {
    backgroundColor: "grey",
    "&:hover": {
      backgroundColor: "grey",
    },
    "&.Mui-disabled": {
      background: "rgb(40,40,40,0.8)",
    },
  },
}));

const PlaybackControls = ({
  playback_state,
  setPlaybackState,
  setPlaybackSpeed,
  playback_loop,
  setPlaybackLoop,
  maximum_speed_level,
  playback_speed,
}) => {
  const timeMode = useSelector(
    (state) => state.dataBank.timeMode,
    shallowEqual
  );
  const primary_mode = useSelector(
    (state) => state.viewMode.mode.primary_mode,
    shallowEqual
  );
  const secondary_mode = useSelector(
    (state) => state.viewMode.mode.secondary_mode,
    shallowEqual
  );
  const mapStyle = useSelector((state) => state.mapStyle, shallowEqual);
  const viewMode = useSelector((state) => state.viewMode, shallowEqual);
  const dispatch = useDispatch();

  function playPauseHandler() {
    setPlaybackState(playback_state !== "playing" ? "playing" : "paused");
  }

  function stepBackwardHandler() {
    setPlaybackState("paused");
    dispatch(
      setCurrentTime({
        current_date: timeMode.current_timestamp_string,
        timedelta: -timeMode.interval_minutes,
      })
    );
  }
  function stepForwardHandler() {
    setPlaybackState("paused");
    dispatch(
      setCurrentTime({
        current_date: timeMode.current_timestamp_string,
        timedelta: timeMode.interval_minutes,
      })
    );
  }
  function skipFrontHandler() {
    setPlaybackState("paused");
    dispatch(setCurrentTime({ current_date: timeMode.start_timestamp_string }));
  }
  function skipEndHandler() {
    setPlaybackState("paused");
    dispatch(setCurrentTime({ current_date: timeMode.end_timestamp_string }));
  }
  function stopHandler() {
    setPlaybackState("stopped");
    setPlaybackSpeed(1);
    dispatch(setCurrentTime({ current_date: timeMode.start_timestamp_string }));
  }
  function loopHandler() {
    setPlaybackLoop(!playback_loop);
  }
  function skyHandler() {
    dispatch(setSky(!mapStyle.sky));
  }
  function sunlightHandler() {
    dispatch(setLighting(!mapStyle.lighting));
  }
  function floorsHandler() {
    dispatch(setLayered(!viewMode.layered));
  }

  const classes = useStyles();
  return (
    <div className={classes.root}>
      <Grid item xs={1}>
        <ButtonGroup size="small">
          <Button
            variant="contained"
            className={classes.playback_control_button}
            aria-label="skip-front"
            onClick={skipFrontHandler}
            disableRipple
            disabled={secondary_mode !== "Real-time"}
          >
            <SkipPreviousIcon fontSize="small" />
          </Button>
          <Button
            variant="contained"
            className={classes.playback_control_button}
            aria-label="step-backward"
            onClick={stepBackwardHandler}
            disableRipple
            disabled={secondary_mode !== "Real-time"}
          >
            <ArrowBackIosIcon fontSize="small" />
          </Button>
          <Button
            variant="contained"
            className={classes.playback_control_button}
            aria-label={playback_state !== "playing" ? "play" : "pause"}
            onClick={playPauseHandler}
            disableRipple
            disabled={secondary_mode !== "Real-time"}
          >
            {playback_state !== "playing" ? (
              <PlayArrowIcon fontSize="small" />
            ) : (
              <PauseIcon fontSize="small" />
            )}
          </Button>
          <Button
            variant="contained"
            className={classes.playback_control_button}
            aria-label="stop"
            onClick={stopHandler}
            disableRipple
            disabled={secondary_mode !== "Real-time"}
          >
            <StopIcon fontSize="small" />
          </Button>
          <Button
            variant="contained"
            className={classes.playback_control_button}
            aria-label="step-forward"
            onClick={stepForwardHandler}
            disableRipple
            disabled={secondary_mode !== "Real-time"}
          >
            <ArrowForwardIosIcon fontSize="small" />
          </Button>
          <Button
            variant="contained"
            className={classes.playback_control_button}
            aria-label="skip-end"
            onClick={skipEndHandler}
            disableRipple
            disabled={secondary_mode !== "Real-time"}
          >
            <SkipNextIcon fontSize="small" />
          </Button>
        </ButtonGroup>
      </Grid>
      <Grid item xs={1} />
      <Grid item xs={1}>
        <ButtonGroup size="small">
          <Button
            variant="contained"
            className={
              playback_loop
                ? classes.toggle_button_enabled
                : classes.toggle_button_disabled
            }
            aria-label="loop"
            onClick={loopHandler}
            disableRipple
            disabled={secondary_mode !== "Real-time"}
          >
            <RepeatIcon fontSize="small" /> Loop
          </Button>
          <Button
            variant="contained"
            className={
              mapStyle.sky
                ? classes.toggle_button_enabled
                : classes.toggle_button_disabled
            }
            aria-label="sky"
            onClick={skyHandler}
            disableRipple
          >
            <CloudIcon fontSize="small" /> Sky
          </Button>
          <Button
            variant="contained"
            className={
              mapStyle.lighting
                ? classes.toggle_button_enabled
                : classes.toggle_button_disabled
            }
            aria-label="sunlight"
            onClick={sunlightHandler}
            disableRipple
          >
            <Brightness7Icon fontSize="small" /> Sunlight
          </Button>
          <Button
            variant="contained"
            className={
              viewMode.layered
                ? classes.toggle_button_enabled
                : classes.toggle_button_disabled
            }
            aria-label="layered"
            onClick={floorsHandler}
            disableRipple
            disabled={primary_mode === "Outbreak Simulation"}
          >
            <LayersIcon fontSize="small" /> Floors
          </Button>
        </ButtonGroup>
      </Grid>
      <Grid item xs={2} />
      <Grid item xs={2}>
        <CameraShortcuts />
      </Grid>
      <Grid item xs={2}>
        <SpeedSlider
          {...{
            maximum_speed_level,
            playback_speed,
            setPlaybackSpeed,
            setPlaybackState,
          }}
        />
      </Grid>
      <Grid item xs={4}>
        <InputTimeRange />
      </Grid>
    </div>
  );
};

export default PlaybackControls;
