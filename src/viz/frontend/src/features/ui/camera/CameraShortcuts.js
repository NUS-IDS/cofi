/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { useSelector, useDispatch, shallowEqual } from "react-redux";

import * as d3 from "d3";

import { FlyToInterpolator } from "react-map-gl";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";

import MyLocationIcon from "@material-ui/icons/MyLocation";
import DomainIcon from "@material-ui/icons/Domain";
import GavelIcon from "@material-ui/icons/Gavel";

import { setViewport } from "../../../app/viewModeSlice";
import { ButtonGroup, FormHelperText } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  fly: {
    backgroundColor: "#e3f2fd",
    "&:hover": {
      backgroundColor: "white",
    },
  },
  flyKR: {
    backgroundColor: "#e3f2fd",
    "&:hover": {
      backgroundColor: "white",
    },
  },
  flyBTC: {
    backgroundColor: "#e3f2fd",
    "&:hover": {
      backgroundColor: "white",
    },
  },
  currentSelection: {
    backgroundColor: "magenta",
    "&:hover": {
      backgroundColor: "magenta",
    },
  },
}));

const CameraShortcuts = () => {
  const viewport = useSelector(
    (state) => state.viewMode.viewport,
    shallowEqual
  );
  const hoverIDPersist = useSelector(
    (state) => state.viewMode.hover.hoverIDPersist
  );
  const hover_lon = useSelector((state) => state.viewMode.hover.lon);
  const hover_lat = useSelector((state) => state.viewMode.hover.lat);
  const dispatch = useDispatch();

  const flyToCommonLocation = (common_location) => {
    if (common_location === "kr") {
      dispatch(
        setViewport({
          ...viewport,
          longitude: 103.776,
          latitude: 1.29908,
          zoom: 15.96,
          pitch: 85,
          bearing: 0,
          transitionDuration: 300,
          transitionInterpolator: new FlyToInterpolator(),
          transitionEasing: d3.easeCubicOut,
        })
      );
    } else if (common_location === "btc") {
      dispatch(
        setViewport({
          ...viewport,
          longitude: 103.8175,
          latitude: 1.32217,
          zoom: 15.96,
          pitch: 85,
          bearing: 0,
          transitionDuration: 300,
          transitionInterpolator: new FlyToInterpolator(),
          transitionEasing: d3.easeCubicOut,
        })
      );
    }
  };

  const pitch2D = () => {
    dispatch(
      setViewport({
        ...viewport,
        pitch: 0,
        zoom: 16,
        transitionDuration: 300,
        transitionInterpolator: new FlyToInterpolator(),
        transitionEasing: d3.easeCubicOut,
      })
    );
  };
  const flyToCurrentSelection = () => {
    dispatch(
      setViewport({
        ...viewport,
        longitude: hover_lon,
        latitude: hover_lat,
        zoom: 18,
        pitch: 55,
        bearing: 0,
        transitionDuration: 300,
        transitionInterpolator: new FlyToInterpolator(),
        transitionEasing: d3.easeCubicOut,
      })
    );
  };

  const classes = useStyles();
  return (
    <ButtonGroup size="small">
      <Button
        variant="contained"
        className={classes.fly}
        aria-label="pitch-2D"
        onClick={pitch2D}
        disableRipple
      >
        2D view
      </Button>
      <Button
        variant="contained"
        className={classes.flyKR}
        aria-label="fly-to-kr"
        onClick={() => flyToCommonLocation("kr")}
        disableRipple
      >
        <DomainIcon fontSize="small" />
        KR
      </Button>
      <Button
        variant="contained"
        className={classes.flyBTC}
        aria-label="fly-to-btc"
        onClick={() => flyToCommonLocation("btc")}
        disableRipple
      >
        <GavelIcon fontSize="small" />
        BTC
      </Button>
      <Button
        variant="contained"
        className={classes.currentSelection}
        aria-label="fly-to-current-selection"
        onClick={flyToCurrentSelection}
        disabled={hoverIDPersist === false}
        disableRipple
      >
        <MyLocationIcon fontSize="small" />
      </Button>
    </ButtonGroup>
  );
};

export default CameraShortcuts;
