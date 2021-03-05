/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: { color: `white`, fontSize: `0.9em` },
  footnote: { color: `yellow`, fontSize: `0.75em` },
  box: {
    float: `left`,
    height: `1em`,
    width: `1em`,
    margin: `0px`,
    border: `1px solid black`,
    clear: `both`,
  },
}));

const Legend = () => {
  const mapStyle = useSelector((state) => state.mapStyle, shallowEqual);
  const viewMode = useSelector((state) => state.viewMode, shallowEqual);
  const [legendData, setLegendData] = useState(<div></div>);

  const classes = useStyles();

  /**
   * Converts any superscript number to unicode string
   * @param {*} number
   * @returns {string}
   */
  function superscript_number_to_unicode(number) {
    const mappings = {
      0: "\u2070",
      1: "\u00b9",
      2: "\u00b2",
      3: "\u00b3",
      4: "\u2074",
      5: "\u2075",
      6: "\u2076",
      7: "\u2077",
      8: "\u2078",
      9: "\u2079",
      "-": "\u207b",
    };

    return Array.from(number)
      .map((digit) => mappings[digit])
      .join("");
  }

  /**
   * Pretty prints a number in exponential scientific notation form
   * @param {*} number
   * @returns {string}
   */
  function prettyExponential(number) {
    const exponential_form = number.toExponential(1);
    const power_value = exponential_form.split("e")[1];

    return power_value === "+0"
      ? `1`
      : `10${superscript_number_to_unicode(power_value)}`;
  }

  useEffect(() => {
    const legend_guide = viewMode.density
      ? mapStyle.session_count_density_scale
      : viewMode.mode.primary_mode === "Outbreak Simulation"
      ? mapStyle.outbreak_scale
      : mapStyle.session_count_scale;
    let data = [];
    for (const level of legend_guide) {
      data.push({
        operator: level[0],
        color: level[2],
        start_value: level[1],
        previous_value: level?.[3] || null,
      });
    }
    const legend_data = [];
    for (const [idx, datapoint] of data.entries()) {
      legend_data.push(
        <div key={`${idx}${datapoint["start_value"]}`}>
          <div
            className={classes.box}
            style={{ backgroundColor: datapoint["color"] }}
          />
          :{" "}
          {viewMode.mode.secondary_mode === "Real-time"
            ? viewMode.density
              ? datapoint["operator"] === "=="
                ? datapoint["start_value"]
                : datapoint["operator"] === "<" && idx !== 1
                ? `${prettyExponential(
                    datapoint["previous_value"]
                  )} to ${prettyExponential(datapoint["start_value"])}`
                : datapoint["operator"] === "<" && idx === 1
                ? `<${prettyExponential(datapoint["start_value"])}`
                : datapoint["operator"] === ">="
                ? `>=${datapoint["start_value"]}`
                : "?"
              : datapoint["operator"] === "=="
              ? datapoint["start_value"]
              : datapoint["operator"] === "<" && idx !== 1
              ? `${datapoint["previous_value"]} to ${datapoint["start_value"]}`
              : datapoint["operator"] === "<" && idx === 1
              ? `${datapoint["previous_value"]}`
              : datapoint["operator"] === ">="
              ? `>=${datapoint["start_value"]}`
              : "?"
            : viewMode.density
            ? datapoint["operator"] === "=="
              ? datapoint["start_value"]
              : datapoint["operator"] === "<" && idx !== 1
              ? `${prettyExponential(
                  datapoint["previous_value"]
                )} to ${prettyExponential(datapoint["start_value"])}`
              : datapoint["operator"] === "<" && idx === 1
              ? `<${prettyExponential(datapoint["start_value"])}`
              : datapoint["operator"] === ">="
              ? `>=${datapoint["start_value"]}`
              : "?"
            : datapoint["operator"] === "=="
            ? datapoint["start_value"] * 15
            : datapoint["operator"] === "<" && idx !== 1
            ? `${datapoint["previous_value"] * 15} to ${
                datapoint["start_value"] * 15
              }`
            : datapoint["operator"] === "<" && idx === 1
            ? `${datapoint["previous_value"] * 15}`
            : datapoint["operator"] === ">="
            ? `>=${datapoint["start_value"] * 15}`
            : "?"}
          <br />
          <br />
        </div>
      );
    }

    setLegendData(legend_data);
  }, [viewMode.mode]);

  return (
    <div className={classes.root}>
      <fieldset style={{ borderColor: "transparent" }}>
        <legend>
          {viewMode.mode.primary_mode === "Outbreak Simulation"
            ? "Number of UserIDs infected"
            : viewMode.mode.secondary_mode === "Real-time"
            ? viewMode.density
              ? `Number of UserIDs present per 16${`m\u00B2`} *`
              : "Number of UserIDs present"
            : viewMode.density
            ? `Number of UserIDs present per 16${`m\u00B2`} *`
            : "Time duration spent by target user (in minutes)"}
        </legend>
        {legendData}
        {viewMode.density ? (
          <span className={classes.footnote}>
            * COVID-19 (Temporary Measures) Act 2020
          </span>
        ) : (
          ``
        )}
      </fieldset>
    </div>
  );
};

export default Legend;
