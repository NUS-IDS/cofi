/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";

import { makeStyles } from "@material-ui/core/styles";
import IconButton from "@material-ui/core/IconButton";

import DeleteIcon from "@material-ui/icons/Delete";

import { setHoverID, setHoverIDPersist } from "../../../app/viewModeSlice";

const useStyles = makeStyles((theme) => ({
  close: {
    color: "#ffffff",
    "& svg": {
      fontSize: "0.7em",
    },
  },
}));

const HighlightDescription = () => {
  const hover = useSelector((state) => state.viewMode.hover, shallowEqual);
  const layered = useSelector((state) => state.viewMode.layered);
  const dispatch = useDispatch();
  const {
    floor,
    session_count,
    session_count_density,
    average_floor_area,
    description,
  } = hover;

  /**
   * Informs Redux store that user is no longer focusing on any building-floor
   */
  function closeHandler() {
    dispatch(setHoverIDPersist(false));
    dispatch(setHoverID(null));
  }

  /**
   * Capitalizes fist letter of each word in a given string
   * @param {string} input
   * @returns {string}
   */
  function capitalize(input) {
    return input
      .toLowerCase()
      .split(" ")
      .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
      .join(" ");
  }

  const classes = useStyles();
  if (hover.hoverID) {
    return (
      <div>
        <hr />
        <div className={classes.close}>
          <div>
            {hover.hoverIDPersist ? (
              <IconButton
                aria-label="close"
                className={classes.close}
                onClick={closeHandler}
              >
                <DeleteIcon />
              </IconButton>
            ) : (
              ``
            )}
            <b>Building Name</b> {capitalize(description)}
          </div>
          <div>
            <b>{layered ? `Floor ` : `Number of Floors `}</b>
            {floor}
          </div>
          <div>
            <b>Average Floor Area</b> {average_floor_area} {`m\u00B2`}
          </div>
          <div>
            <b>Number of UserIDs present </b>
            {session_count === -1 ? 0 : session_count}
          </div>
          <div>
            <b>Number of UserIDs present per 16 {`m\u00B2`} </b>
            {session_count_density}
          </div>
        </div>
      </div>
    );
  } else {
    return <div></div>;
  }
};
export default HighlightDescription;
