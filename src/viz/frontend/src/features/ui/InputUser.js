/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";

import { Grid } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import IconButton from "@material-ui/core/IconButton";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";

import SearchIcon from "@material-ui/icons/Search";

import { setUserIdKey } from "../../app/dataBankSlice";

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
    "&.Mui-disabled": {
      background: "rgb(40,40,40,0.8)",
    },
  },
  formControl: {
    margin: theme.spacing(0),
    minWidth: "10em",
    backgroundColor: "rgb(0,0,0,0)",
    "&.Mui-disabled": {
      background: "rgb(40,40,40,0.8)",
    },
  },
}));

const InputUser = () => {
  const user = useSelector((state) => state.dataBank.user, shallowEqual);
  const usersByID = useSelector(
    (state) => state.dataBank.usersByID,
    shallowEqual
  );
  const loadStatus = useSelector(
    (state) => state.dataBank.loadStatus,
    shallowEqual
  );
  const primary_mode = useSelector((state) => state.viewMode.mode.primary_mode);
  const dispatch = useDispatch();

  const classes = useStyles();

  const [userid_key_input, setUserIdKeyInput] = useState("");

  const handleAddUserInput = (event) => {
    event.preventDefault();
    dispatch(setUserIdKey({ userid_key_input, mode: "add user" }));
    setUserIdKeyInput("");
  };
  const handleShowUserInput = (event) => {
    dispatch(
      setUserIdKey({
        userid_key_input: event.target.value,
        mode: "show existing user",
      })
    );
  };
  return (
    <Grid container>
      <Grid item xs={7} />
      <Grid item xs={2}>
        <FormControl
          variant="filled"
          className={classes.formControl}
          disabled={primary_mode === "Outbreak Simulation"}
        >
          <InputLabel id="select-userid-key-to-show" className={classes.input}>
            Select Primary userID
          </InputLabel>
          <Select
            labelId="select-userid-key-to-show"
            id="select-userid-key-to-show"
            value={user.userid_key}
            onChange={handleShowUserInput}
            className={classes.input}
          >
            {Object.keys(usersByID).map((userid_key) => (
              <MenuItem key={userid_key} value={userid_key}>
                {userid_key}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={1}>
        <Paper
          component="form"
          className={classes.root}
          onSubmit={handleAddUserInput}
        >
          <InputBase
            className={classes.input}
            placeholder="Import userID"
            inputProps={{ "aria-label": "search" }}
            value={userid_key_input}
            onInput={(e) => setUserIdKeyInput(e.target.value)}
            disabled={
              loadStatus.loaded === false ||
              primary_mode === "Outbreak Simulation"
            }
          />
          <IconButton
            type="submit"
            className={classes.iconButton}
            aria-label="search"
            disabled={
              loadStatus.loaded === false ||
              primary_mode === "Outbreak Simulation"
            }
          >
            <SearchIcon />
          </IconButton>
        </Paper>
      </Grid>
    </Grid>
  );
};
export default InputUser;
