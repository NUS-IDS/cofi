/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
} from "react-router-dom";

import { CircularProgress, Grid } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Map from "./features/map/Map";
import ControlUI from "./features/ui/ControlUI";
import Legend from "./features/ui/info/Legend";
import SessionOverlaps from "./features/ui/contact_tracing/SessionOverlaps";
//import FilterUser from "./features/ui/FilterUser";

import DataWatcher from "./DataWatcher";
import Status from "./features/ui/info/Status";
import { shallowEqual, useSelector } from "react-redux";
import InputSimulation from "./features/ui/InputSimulation";
const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: "rgb(0,0,0,0.8)",
    position: "fixed",
    zIndex: 2,
    padding: "1vh 0 0 0",
    borderRadius: "1em",
  },
  map_container: {
    position: "fixed",
    display: "grid",
    gridTemplateColumns: "100vw",
    gridTemplateRows: "100vh",
    zIndex: 1,
  },
  ui_controls: {
    bottom: 0,
    width: "100vw",
    height: "20vh",
    borderRadius: "1em 1em 0em 0em",
  },
  ui_sidebar: { top: "25vh", right: 0, width: "30vw", height: "73vh" },
  statusbar: { bottom: "22vh", left: 0 },
  highlightdescription: {},
  legend: { top: "3.5vh", left: 0, width: "11vw", height: "34vh" },
  gantt: {
    top: "1vh",
    right: 0,
    width: "35vw",
    height: "76vh",
  },
  simulation_bar: {
    bottom: "22vh",
    left: "12vw",
    height: "14vh",
    width: "60vw",
  },
  progress_indicator: {
    top: "50vh",
    left: "50vw",
    position: "fixed",
    zIndex: 2,
  },
}));
const App = () => {
  const loadStatus = useSelector(
    (state) => state.dataBank.loadStatus,
    shallowEqual
  );
  const primary_mode = useSelector((state) => state.viewMode.mode.primary_mode);
  const secondary_mode = useSelector(
    (state) => state.viewMode.mode.secondary_mode
  );

  const classes = useStyles();

  return (
    <Router>
      <div className="App">
        <Switch>
          <Route
            exact
            path="/"
            render={() => (
              <>
                <DataWatcher />

                {loadStatus.loaded && primary_mode === "Track User Location" ? (
                  <div className={`${classes.root} ${classes.gantt}`}>
                    <SessionOverlaps />
                  </div>
                ) : (
                  <></>
                )}

                <div className={`${classes.map_container}`}>
                  <Map />
                </div>
                <div className={`${classes.root} ${classes.ui_controls}`}>
                  <Grid container item xs={12}>
                    <ControlUI />
                  </Grid>
                </div>
                {/* 
                <div className={`${classes.root} ${classes.ui_sidebar}`}>
                  <Grid container>
                    <Grid container item xs={12}>
                      <FilterUser /> 
                    </Grid>
                  </Grid>
                </div>
                */}
                <Status classes={classes} />

                {primary_mode === "Outbreak Simulation" ? (
                  <div className={`${classes.root} ${classes.simulation_bar}`}>
                    <InputSimulation />
                  </div>
                ) : (
                  <></>
                )}

                <div className={`${classes.root} ${classes.legend}`}>
                  <Grid container item>
                    <Grid item xs={1} />
                    <Grid item xs={10}>
                      <Legend />
                    </Grid>
                    <Grid item xs={1} />
                  </Grid>
                </div>

                <div className={`${classes.progress_indicator}`}>
                  <Grid container item>
                    {loadStatus.loaded ? (
                      ""
                    ) : (
                      <CircularProgress
                        disableShrink
                        style={{ color: "cyan" }}
                      />
                    )}
                  </Grid>
                </div>
              </>
            )}
          />
          <Redirect to="/" />
        </Switch>
      </div>
    </Router>
  );
};

export default App;
