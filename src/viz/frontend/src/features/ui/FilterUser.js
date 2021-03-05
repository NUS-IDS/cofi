/* eslint-disable react-hooks/exhaustive-deps */
/*
import React, { useState, useEffect } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";

import { Grid } from "@material-ui/core";
import { makeStyles, createMuiTheme, MuiThemeProvider } from "@material-ui/core/styles";
import MaterialTable from "material-table";
import Tooltip from '@material-ui/core/Tooltip';
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import IconButton from "@material-ui/core/IconButton";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";

import SearchIcon from "@material-ui/icons/Search";

import FlagIcon from "@material-ui/icons/Flag";
import ColorLensIcon from "@material-ui/icons/ColorLens";
import NearMeIcon from "@material-ui/icons/NearMe";
import DeleteIcon from "@material-ui/icons/Delete"

import { setUserIdKey, toggleUserTrailVisibility, toggleUserTrailColor, deleteUserIdKey } from "../../app/dataBankSlice";

const useStyles = makeStyles((theme) => ({
    root: {
        padding: "0px 0px",
        display: "flex",
        alignItems: "center",
        width: "12em",
    },
    input: {
        marginLeft: theme.spacing(0),
        flex: 1,
        color: "black",
    },
    iconButton: {
        padding: 0,
        color: "black",
    },
    formControl: {
        margin: theme.spacing(0),
        minWidth: "12em",
        backgroundColor: theme.palette.background.paper,
    },
    select: {
        fill: "#ffffff",
    },
}));


const FilterUser = () => {
    const user = useSelector((state) => state.dataBank.user, shallowEqual);
    const usersByID = useSelector((state) => state.dataBank.usersByID, shallowEqual);
    const loadStatus = useSelector((state) => state.dataBank.loadStatus, shallowEqual);
    const dispatch = useDispatch();

    const classes = useStyles();

    const iconMappings = {
        'flag': <FlagIcon />,
        'color_lens': <ColorLensIcon />,
        'near_me': <NearMeIcon />,
        'delete': <DeleteIcon />,
    }
    function generateButtonColor(tooltip, userid_key) {
        if (tooltip === "Set as Primary")
            return user.userid_key === userid_key ? 'green' : 'grey';
        else if (tooltip === "Set Trajectory Color")
            return usersByID[userid_key].trail_color;
        else if (tooltip === "Show Trajectory")
            return usersByID[userid_key].trail_visible ? 'yellow' : 'grey';
        else if (tooltip === "Delete User")
            return 'pink';
        else return 'white';
    }


    return (
        <Grid container>
            <Grid item xs={1} />
            <Grid item xs={10}>

                <MaterialTable
                    style={{ backgroundColor: "rgb(0,0,0,0)", color: 'white' }}
                    title=""
                    columns={[
                        { title: 'User', field: 'userid_key' },
                    ]}
                    data={
                        Object.keys(usersByID).map(userid_key => { return { userid_key } })
                    }
                    actions={[
                        {
                            icon: 'flag',
                            tooltip: 'Set as Primary',
                            onClick: (event, rowData) => dispatch(setUserIdKey(rowData.userid_key))
                        },
                        {
                            icon: 'color_lens',
                            tooltip: 'Set Trajectory Color',
                            onClick: (event, rowData) => dispatch(toggleUserTrailColor(rowData.userid_key))
                        },
                        {
                            icon: 'near_me',
                            tooltip: 'Show Trajectory',
                            onClick: (event, rowData) => dispatch(toggleUserTrailVisibility(rowData.userid_key))
                        },
                        {
                            icon: 'delete',
                            tooltip: 'Delete User',
                            onClick: (event, rowData) => dispatch(deleteUserIdKey(rowData.userid_key))
                        },

                    ]}

                    components={{
                        Action: props =>
                            <Tooltip title={props.action.tooltip}>
                                <IconButton onClick={(event) => props.action.onClick(event, props.data)}
                                    style={{
                                        color: generateButtonColor(props.action.tooltip, props.data.userid_key)
                                    }}>
                                    {iconMappings[props.action.icon]}</IconButton>
                            </Tooltip>,
                        Container: props => <Paper {...props} elevation={0} />
                    }}

                    options={{
                        headerStyle: {
                            backgroundColor: "rgb(0,0,0,0)",
                            color: '#FFF'
                        },
                        searchFieldStyle: {
                            backgroundColor: "rgb(0,0,0,0)",
                            color: '#FFF'
                        },
                        paging: true,
                        pageSizeOptions: [7],
                        pageSize: 7,
                        paginationType: "stepped",
                        paginationPosition: "bottom",
                        minBodyHeight: "55vh",
                        actionsColumnIndex: -1
                    }}
                />

            </Grid>
            <Grid item xs={1} />
        </Grid>
    );
};
export default FilterUser;
*/