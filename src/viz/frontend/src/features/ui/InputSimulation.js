/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { Button, FormHelperText, Grid } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import IconButton from "@material-ui/core/IconButton";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";

import SearchIcon from "@material-ui/icons/Search";
import { fetchSimulation } from "../../app/dataBankSlice";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: "0px 0px",
    display: "flex",
    alignItems: "center",
    width: "10em",
    backgroundColor: "rgb(0,0,0,0)",
  },
  input: {
    marginLeft: theme.spacing(0),
    flex: 1,
    color: "white",
    "&.Mui-disabled": {
      background: "rgb(40,40,40,0.8)",
    },
  },
  iconButton: {
    padding: 0,
    color: "white",
  },
  formControl: {
    margin: theme.spacing(0),
    minWidth: "10em",
    backgroundColor: "rgb(0,0,0,0)",
  },
  run_simulation_button: {
    backgroundColor: "cyan",
    "&:hover": {
      backgroundColor: "cyan",
    },
    "&.Mui-disabled": {
      background: "rgb(40,40,40,0.8)",
    },
  },
}));

const InputSimulation = () => {
  const loadStatus = useSelector(
    (state) => state.dataBank.loadStatus,
    shallowEqual
  );
  const params_names = {
    model: "Model",
    beta: "Transmission Rate",
    theta: "Incubation Rate",
    gamma: "Recovery Rate",
    i0: "Patient Zero UserID",
    start: "Sampling Start Time",
    end: "Sampling End Time",
    T: "Simulation End Time",
    save_interval: "Save Interval",
    seed: "Random Seed",
    N: "Number of Simulations",
    cumulative: "Cumulative?",
  };
  const [params, setParams] = useState({
    model: "sir",
    beta: "3.85802469e-06",
    theta: "",
    gamma: "8.26719577e-07",
    i0: "31761",
    start: "2020-01-13 00:00:00",
    end: "2020-01-24 23:59:59",
    T: "2020-04-06 23:59:59",
    save_interval: 900,
    seed: 5921,
    N: "",
    cumulative: "true",
  });
  const dispatch = useDispatch();
  const classes = useStyles();

  const handleSubmitParams = (event) => {
    event.preventDefault();
    // Validate inputs before dispatch
    //dispatch();
  };
  /*
  {
    "model": "sir",
    "beta": %0.8e,
    "theta": %0.8e,
    "gamma": %0.8e,
    "i0": current_userid_key,
    "start": "yyyy-mm-ddTH:M:S",
    "end": "yyyy-mm-ddTH:M:S",
    "T": "yyyy-mm-ddTH:M:S",
    "save_interval": number,
    "seed": number,
  }
  */
  return (
    <Grid container>
      <Grid item xs={1} />
      <Grid container item xs={11}>
        <Grid item xs={12}>
          <div>
            <FormHelperText style={{ color: "white" }}>
              Simulation Parameters
            </FormHelperText>
          </div>
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["model"]}
            inputProps={{ "aria-label": params_names["model"] }}
            value={params["model"]}
            onInput={(e) => {
              setParams({ ...params, ...{ model: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["beta"]}
            inputProps={{ "aria-label": params_names["beta"] }}
            value={params["beta"]}
            onInput={(e) => {
              setParams({ ...params, ...{ beta: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["theta"]}
            inputProps={{ "aria-label": params_names["theta"] }}
            value={params["theta"]}
            onInput={(e) => {
              setParams({ ...params, ...{ theta: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["gamma"]}
            inputProps={{ "aria-label": params_names["gamma"] }}
            value={params["gamma"]}
            onInput={(e) => {
              setParams({ ...params, ...{ gamma: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["i0"]}
            inputProps={{ "aria-label": params_names["i0"] }}
            value={params["i0"]}
            onInput={(e) => {
              setParams({ ...params, ...{ i0: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["start"]}
            inputProps={{ "aria-label": params_names["start"] }}
            value={params["start"]}
            onInput={(e) => {
              setParams({ ...params, ...{ start: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["end"]}
            inputProps={{ "aria-label": params_names["end"] }}
            value={params["end"]}
            onInput={(e) => {
              setParams({ ...params, ...{ end: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["T"]}
            inputProps={{ "aria-label": params_names["T"] }}
            value={params["T"]}
            onInput={(e) => {
              setParams({ ...params, ...{ T: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["save_interval"]}
            inputProps={{ "aria-label": params_names["save_interval"] }}
            value={params["save_interval"]}
            onInput={(e) => {
              setParams({ ...params, ...{ save_interval: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["seed"]}
            inputProps={{ "aria-label": params_names["seed"] }}
            value={params["seed"]}
            onInput={(e) => {
              setParams({ ...params, ...{ seed: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Grid item xs={3}>
          <InputBase
            className={classes.input}
            placeholder={params_names["cumulative"]}
            inputProps={{ "aria-label": params_names["cumulative"] }}
            value={params["cumulative"]}
            onInput={(e) => {
              setParams({ ...params, ...{ cumulative: e.target.value } });
            }}
            disabled={loadStatus.loaded === false}
          />
        </Grid>
        <Button
          variant="contained"
          className={classes.run_simulation_button}
          aria-label="run simulation"
          onClick={() => dispatch(fetchSimulation(params))}
          disabled={loadStatus.loaded === false}
          disableRipple
        >
          Run Simulation
        </Button>
        )
      </Grid>
    </Grid>
  );
};
export default InputSimulation;
