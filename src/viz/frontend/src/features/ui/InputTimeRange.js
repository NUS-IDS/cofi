/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { useSelector, useDispatch, shallowEqual } from "react-redux";

import { Grid, Input, Typography } from "@material-ui/core";
import {
  createMuiTheme,
  makeStyles,
  ThemeProvider,
} from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";

import UpdateIcon from "@material-ui/icons/Update";

import DateFnsUtils from "@date-io/date-fns";
import { addMinutes, subMinutes } from "date-fns";

import { setCurrentTime, setStartAndEndTime } from "../../app/dataBankSlice";
import { formatTimestampToString } from "../../helpers/dataBankSlicehelpers";

import { MuiPickersUtilsProvider, DateTimePicker } from "@material-ui/pickers";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: "0px 0px",
    width: "10em",
    background: "white",
  },
  update_dates_button: {
    backgroundColor: "cyan",
    "&:hover": {
      backgroundColor: "cyan",
    },
  },
}));

const pickerTheme = createMuiTheme({
  palette: {
    primary: { 500: "#00FFFF" },
  },
});

const InputTimeRange = () => {
  const timeMode = useSelector(
    (state) => state.dataBank.timeMode,
    shallowEqual
  );
  const secondary_mode = useSelector(
    (state) => state.viewMode.mode.secondary_mode
  );
  const dispatch = useDispatch();

  const [selectedCurrentDate, setSelectedCurrentDate] = useState(
    new Date(timeMode.current_timestamp_string)
  );
  const [selectedStartDate, setSelectedStartDate] = useState(
    new Date(timeMode.start_timestamp_string)
  );
  const [selectedEndDate, setSelectedEndDate] = useState(
    new Date(timeMode.end_timestamp_string)
  );

  useEffect(() => {
    setSelectedCurrentDate(new Date(timeMode.current_timestamp_string));
  }, [timeMode.current_timestamp_string]);

  /**
   * Dispatches current timestamp to Redux store
   * @param {Date} d
   */
  function handleCurrentDateChange(d) {
    const current_date = formatTimestampToString(d);
    dispatch(setCurrentTime({ current_date: current_date }));
  }

  /**
   * Updates start timestamp state hook, ensuring that it is no later than selected end timestamp
   * @param {Date} d
   */
  function handleStartDateChange(d) {
    if (d < selectedEndDate) {
      setSelectedStartDate(d);
    } else {
      // Attempted to set selected start timestamp >= selected end timestamp
      // hence selected start timestamp will be automatically set to latest possible timing
      setSelectedStartDate(
        subMinutes(selectedEndDate, timeMode.interval_minutes)
      );
    }
  }

  /**
   * Updates end timestamp state hook, ensuring that it is no earlier than selected start timestamp
   * @param {Date} d
   */
  function handleEndDateChange(d) {
    if (d > selectedStartDate) {
      setSelectedEndDate(d);
    } else {
      // Attempted to set selected end timestamp <= selected start timestamp
      // hence selected end timestamp will be automatically set to earliest possible timing
      setSelectedEndDate(
        addMinutes(selectedStartDate, timeMode.interval_minutes)
      );
    }
  }

  /**
   * Dispatches selected start date and selected end date to Redux store
   */
  function handleUpdateDates() {
    const start_date = formatTimestampToString(selectedStartDate);
    const end_date = formatTimestampToString(selectedEndDate);
    dispatch(
      setStartAndEndTime({
        start_date,
        end_date,
      })
    );
  }

  const classes = useStyles();

  const renderCurrentTime = (props) => (
    <Typography
      onClick={props.onClick}
      value={props.value}
      onChange={props.onChange}
    >
      current time!
    </Typography>
  );

  const renderStartTime = (props) => (
    <Typography
      onClick={props.onClick}
      value={props.value}
      onChange={props.onChange}
    >
      start time!
    </Typography>
  );

  const renderEndTime = (props) => (
    <Typography
      onClick={props.onClick}
      value={props.value}
      onChange={props.onChange}
    >
      end time!
    </Typography>
  );
  return (
    <div>
      <ThemeProvider theme={pickerTheme}>
        <Grid container>
          <MuiPickersUtilsProvider utils={DateFnsUtils}>
            <Grid item xs={12}>
              <DateTimePicker
                disabled={secondary_mode !== "Real-time"}
                variant="dialog"
                ampm={true}
                label="Jump to Time & Date"
                value={selectedCurrentDate}
                onChange={handleCurrentDateChange}
                format="EEE HH:mm dd/MM/yy"
                minutesStep={timeMode.interval_minutes}
                minDate={new Date(timeMode.start_timestamp_string)}
                maxDate={new Date(timeMode.end_timestamp_string)}
                className={classes.root}
                style={{
                  background:
                    secondary_mode !== "Real-time"
                      ? "rgb(40,40,40,0.8)"
                      : "white",
                }}
                //TextFieldComponent={renderCurrentTime}
              />{" "}
              <DateTimePicker
                variant="dialog"
                ampm={true}
                label="Start Time & Date"
                value={selectedStartDate}
                onChange={handleStartDateChange}
                format="EEE HH:mm dd/MM/yy"
                minutesStep={timeMode.interval_minutes}
                maxDate={subMinutes(selectedEndDate, timeMode.interval_minutes)}
                className={classes.root}
                //TextFieldComponent={renderStartTime}
              />
              <DateTimePicker
                variant="dialog"
                ampm={true}
                label="End Time & Date"
                value={selectedEndDate}
                onChange={handleEndDateChange}
                format="EEE HH:mm dd/MM/yy"
                minutesStep={timeMode.interval_minutes}
                minDate={addMinutes(
                  selectedStartDate,
                  timeMode.interval_minutes
                )}
                className={classes.root}
                //TextFieldComponent={renderEndTime}
              />
              <Button
                variant="contained"
                className={classes.update_dates_button}
                aria-label="update dates"
                onClick={handleUpdateDates}
                disabled={false}
                disableRipple
              >
                <UpdateIcon fontSize="large" />
              </Button>
            </Grid>
          </MuiPickersUtilsProvider>
        </Grid>
      </ThemeProvider>
    </div>
  );
};
export default InputTimeRange;
