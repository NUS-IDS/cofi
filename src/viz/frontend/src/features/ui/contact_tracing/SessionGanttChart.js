import React, { useEffect, useRef } from "react";
import d3 from "d3v3";

const SessionGanttChart = (props) => {
  const ref = useRef(null);

  useEffect(() => {
    drawChart();
  }, [props]);

  function drawChart() {
    const {
      sessions,
      userIDs,
      sessionStatus,
      tickFormat,
      start_timestamp,
      end_timestamp,
      current_timestamp,
      current_userid_key,
    } = props;
    // Convert date strings in sessions to Date() objects
    const sessions_ = sessions.map((x) => {
      const y = {
        startDate: new Date(x.startDate),
        endDate: new Date(x.endDate),
        userID: x.userID,
      };
      return y;
    });

    d3.gantt = function () {
      let FIT_TIME_DOMAIN_MODE = "fit";
      let FIXED_TIME_DOMAIN_MODE = "fixed";

      let margin = {
        top: 40,
        right: 40,
        bottom: 20,
        left: 65,
      };
      let timeDomainStart = d3.time.day.offset(new Date(start_timestamp), -3);
      let timeDomainEnd = d3.time.hour.offset(new Date(end_timestamp), +3);
      let timeDomainMode = FIT_TIME_DOMAIN_MODE; // fixed or fit
      let userIDs = [];
      let sessionStatus = [];
      let height =
        (document.body.clientHeight - margin.top - margin.bottom - 5) * 0.77;
      let width =
        (document.body.clientWidth - margin.right - margin.left - 5) * 0.31;

      let tickFormat = "%H:%M";

      let keyFunction = function (d) {
        return d.startDate + d.userID + d.endDate;
      };

      let rectTransform = function (d) {
        return "translate(" + x(d.startDate) + "," + y(d.userID) + ")";
      };

      let x = d3.time
        .scale()
        .domain([timeDomainStart, timeDomainEnd])
        .range([0, width])
        .clamp(true);

      let y = d3.scale
        .ordinal()
        .domain(userIDs)
        .rangeRoundBands([0, height - margin.top - margin.bottom], 0.1);

      let xAxis = d3.svg
        .axis()
        .scale(x)
        .orient("bottom")
        .tickFormat(d3.time.format(tickFormat))
        .tickSubdivide(true)
        .tickSize(8)
        .tickPadding(8);

      let yAxis = d3.svg.axis().scale(y).orient("left").tickSize(0);

      let initTimeDomain = function () {
        if (timeDomainMode === FIT_TIME_DOMAIN_MODE) {
          if (sessions_ === undefined || sessions_.length < 1) {
            timeDomainStart = d3.time.day.offset(new Date(), -3);
            timeDomainEnd = d3.time.hour.offset(new Date(), +3);
            return;
          }
          sessions_.sort(function (a, b) {
            return a.endDate - b.endDate;
          });
          timeDomainEnd = sessions_[sessions_.length - 1].endDate;
          sessions_.sort(function (a, b) {
            return a.startDate - b.startDate;
          });
          timeDomainStart = sessions_[0].startDate;
        }
      };

      let initAxis = function () {
        x = d3.time
          .scale()
          .domain([timeDomainStart, timeDomainEnd])
          .range([0, width])
          .clamp(true);
        y = d3.scale
          .ordinal()
          .domain(userIDs)
          .rangeRoundBands([0, height - margin.top - margin.bottom], 0.1);
        xAxis = d3.svg
          .axis()
          .scale(x)
          .orient("bottom")
          .tickFormat(d3.time.format(tickFormat))
          .tickSubdivide(true)
          .tickSize(8)
          .tickPadding(0)
          .ticks(5); // control number of ticks

        yAxis = d3.svg.axis().scale(y).orient("left").tickSize(8);
      };

      function gantt(sessions_) {
        initTimeDomain();
        initAxis();
        let today = new Date(current_timestamp);

        let svg = d3
          .select(ref.current)
          .attr("class", "chart")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          .append("g")
          .attr("class", "gantt-chart")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          .attr(
            "transform",
            "translate(" + margin.left + ", " + margin.top + ")"
          );

        svg
          .selectAll(".chart")
          .data(sessions_, keyFunction)
          .enter()
          .append("rect")
          .attr("rx", 0)
          .attr("ry", 0)
          .attr("class", function (d) {
            if (d.startDate <= today && d.endDate >= today) {
              return "bar-contacted";
            } else if (sessionStatus[d.status] == null) {
              return "bar-normal";
            } else {
              return sessionStatus[d.status];
            }
          })
          .attr("y", 0)
          .attr("transform", rectTransform)
          .attr("height", function (d) {
            return y.rangeBand();
          })
          .attr("width", function (d) {
            return x(d.endDate) - x(d.startDate);
          });

        svg
          .append("g")
          .attr("class", "x axis")
          .attr(
            "transform",
            "translate(0, " + (height - margin.top - margin.bottom) + ")"
          )
          //.transition()
          .call(xAxis);

        svg
          .append("g")
          .attr("class", "y axis")
          //.transition()
          .call(yAxis);

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
            "UserIDs sharing same WiFi Access Point with UserID " +
              current_userid_key
          );

        // X-axis label
        svg
          .append("text")
          .attr("class", "x label")
          .attr("text-anchor", "end")
          .attr("x", width)
          .attr("y", height - 24)
          .attr("dy", ".75em")
          .style("fill", "white")
          .text("Time");

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

        // Vertical line to indicate current timestamp
        if (timeDomainStart <= today && timeDomainEnd >= today) {
          svg
            .append("line")
            .attr("x1", x(today))
            .attr("y1", 0)
            .attr("x2", x(today))
            .attr("y2", height - margin.top - margin.bottom)
            .style("stroke-width", 2)
            .style("stroke", "red")
            .style("fill", "none");
        }
        return gantt;
      }

      gantt.margin = function (value) {
        if (!arguments.length) return margin;
        margin = value;
        return gantt;
      };

      gantt.timeDomain = function (value) {
        if (!arguments.length) return [timeDomainStart, timeDomainEnd];
        timeDomainStart = +value[0];
        timeDomainEnd = +value[1];
        return gantt;
      };

      /**
       * @param {string}
       *                vale The value can be "fit" - the domain fits the data or
       *                "fixed" - fixed domain.
       */
      gantt.timeDomainMode = function (value) {
        if (!arguments.length) return timeDomainMode;
        timeDomainMode = value;
        return gantt;
      };

      gantt.userIDs = function (value) {
        if (!arguments.length) return userIDs;
        userIDs = value;
        return gantt;
      };

      gantt.sessionStatus = function (value) {
        if (!arguments.length) return sessionStatus;
        sessionStatus = value;
        return gantt;
      };

      gantt.width = function (value) {
        if (!arguments.length) return width;
        width = +value;
        return gantt;
      };

      gantt.height = function (value) {
        if (!arguments.length) return height;
        height = +value;
        return gantt;
      };

      gantt.tickFormat = function (value) {
        if (!arguments.length) return tickFormat;
        tickFormat = value;
        return gantt;
      };

      return gantt;
    };
    const gantt = d3
      .gantt()
      .userIDs(userIDs)
      .sessionStatus(sessionStatus)
      .tickFormat(tickFormat);
    d3.select("svg > g").remove();
    gantt(sessions_);
  }

  return <svg ref={ref}></svg>;
};

export default SessionGanttChart;
