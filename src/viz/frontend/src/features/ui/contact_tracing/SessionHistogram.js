import React, { useEffect, useRef } from "react";
import d3 from "d3v3";

// total_overlap_duration_per_userid
const SessionHistogram = (props) => {
  const ref = useRef(null);
  useEffect(() => {
    drawChart();
  }, [props]);
  function drawChart() {
    const { data, current_userid_key } = props;
    d3.select("svg > g").remove();
    let margin = {
      top: 40,
      right: 130,
      bottom: 20,
      left: 65,
    };
    let height =
      (document.body.clientHeight - margin.top - margin.bottom - 5) * 0.77;
    let width =
      (document.body.clientWidth - margin.right - margin.left - 5) * 0.31;

    let svg = d3
      .select(ref.current)
      .attr("class", "chart")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    let x = d3.scale
      .linear()
      .range([0, width])
      .domain([
        0,
        d3.max(data, function (d) {
          return d.totalDuration;
        }),
      ]);

    let y = d3.scale
      .ordinal()
      .rangeRoundBands([0, height - margin.top - margin.bottom], 0.1)
      .domain(
        data.map(function (d) {
          return d.userID;
        })
      );

    //make y axis to show bar names
    let yAxis = d3.svg.axis().scale(y).tickSize(0).orient("left");

    let gy = svg.append("g").attr("class", "y axis").call(yAxis);

    let bars = svg.selectAll(".chart").data(data).enter().append("g");

    //append rects
    bars
      .append("rect")
      .attr("class", "bar-normal")
      .attr("y", function (d) {
        return y(d.userID);
      })
      .attr("height", y.rangeBand())
      .attr("x", 0)
      .attr("width", function (d) {
        return x(d.totalDuration);
      });

    //add a value label to the right of each bar
    bars
      .append("text")
      .attr("class", "label")
      //y position of the label is halfway down the bar
      .attr("y", function (d) {
        return y(d.userID) + y.rangeBand() / 2 + 4;
      })
      //x position is 3 pixels to the right of the bar
      .attr("x", function (d) {
        return x(d.totalDuration) + 3;
      })
      .text(function (d) {
        return new Date(d.totalDuration * 1000).toISOString().substr(11, 8);
        //return;
      });

    // Title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 0 - margin.top / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("fill", "white")
      .style("text-decoration", "underline")
      .text(
        "Total Contact Duration of UserIDs sharing same WiFi Access Point with UserID " +
          current_userid_key
      );

    // X-axis label
    svg
      .append("text")
      .attr("class", "x label")
      .attr("text-anchor", "end")
      .attr("x", width + 35)
      .attr("y", height - 24)
      .attr("dy", ".75em")
      .style("fill", "white")
      .text("Total Duration");

    // Y-axis label
    svg
      .append("text")
      .attr("class", "y label")
      .attr("text-anchor", "end")
      .attr("x", 0)
      .attr("y", -15)
      .attr("dy", ".75em")
      .style("fill", "white")
      .text("UserIDs");
  }
  return <svg ref={ref}></svg>;
};
export default SessionHistogram;
