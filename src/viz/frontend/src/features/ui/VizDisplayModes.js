/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { useSelector, useDispatch, shallowEqual } from "react-redux";

import FormHelperText from "@material-ui/core/FormHelperText";
import { Grid, Typography } from "@material-ui/core";
import { withStyles, makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";

import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemText from "@material-ui/core/ListItemText";

import { setMode } from "../../app/viewModeSlice";

const useStyles = makeStyles((theme) => ({
  display_mode_button: {
    backgroundColor: "cyan",
    "&:hover": {
      backgroundColor: "cyan",
    },
  },
}));

const StyledMenu = withStyles({
  paper: {
    border: "0px solid #fff",
  },
})((props) => (
  <Menu
    elevation={0}
    getContentAnchorEl={null}
    anchorOrigin={{
      vertical: "bottom",
      horizontal: "center",
    }}
    transformOrigin={{
      vertical: "top",
      horizontal: "center",
    }}
    {...props}
  />
));

const StyledMenuItem = withStyles((theme) => ({
  root: {
    "&:focus": {
      backgroundColor: "#ff0",
      "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
        color: theme.palette.common.black,
      },
    },
  },
}))(MenuItem);

const VizDisplayModes = () => {
  const mode = useSelector((state) => state.viewMode.mode);
  const display_modes = useSelector((state) => state.viewMode.display_modes);
  const dispatch = useDispatch();

  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedDisplayMode, setSelectedDisplayMode] = useState([
    mode.primary_mode,
    mode.secondary_mode,
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleClickListItem = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = (option, index) => {
    const primary_mode = option[0];
    const secondary_mode = option[1];
    dispatch(setMode({ primary_mode, secondary_mode }));
    setSelectedDisplayMode(option);
    setSelectedIndex(index);
    setAnchorEl(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };
  const classes = useStyles();
  return (
    <Grid container>
      <Grid item xs={12}>
        <div>
          <FormHelperText style={{ color: "white" }}>
            Display Mode
          </FormHelperText>
        </div>
        <div>
          <Button
            size="small"
            aria-controls="display-mode-menu"
            aria-haspopup="true"
            variant="contained"
            className={classes.display_mode_button}
            onClick={handleClickListItem}
            disableRipple
            fullWidth
          >
            {selectedDisplayMode[0]} : {selectedDisplayMode[1]}
          </Button>
          <StyledMenu
            id="display-mode-menu"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            {display_modes.map((option, index) => (
              <StyledMenuItem
                key={option}
                selected={index === selectedIndex}
                onClick={() => handleMenuItemClick(option, index)}
              >
                <ListItemText primary={option[0]} secondary={option[1]} />
              </StyledMenuItem>
            ))}
          </StyledMenu>
        </div>
      </Grid>
    </Grid>
  );
};

export default VizDisplayModes;
