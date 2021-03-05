import React from "react";
import { useSelector } from "react-redux";
import { Grid } from "@material-ui/core";
import HighlightDescription from "./HighlightDescription";
import Statusbar from "./Statusbar";

const Status = ({ classes }) => {
  const hoverID = useSelector((state) => state.viewMode.hover.hoverID);

  return (
    <div
      className={`${classes.root} ${classes.statusbar}`}
      style={{
        height: `${hoverID ? "34vh" : "8vh"}`,
        width: `${hoverID ? "11vw" : "11vw"}`,
      }}
    >
      <Grid container item>
        <Grid item xs={1} />
        <Grid item xs={10}>
          <Statusbar />
        </Grid>
        <Grid item xs={1} />
        <Grid item xs={1} />
        <Grid item xs={10}>
          <HighlightDescription />
        </Grid>
        <Grid item xs={1} />
      </Grid>
    </div>
  );
};
export default Status;
