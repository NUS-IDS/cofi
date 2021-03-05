import React from "react";
import { useSelector, shallowEqual } from "react-redux";
import SessionGanttChart from "./SessionGanttChart";
import SessionHistogram from "./SessionHistogram";

import "./style.css";

const SessionOverlaps = () => {
  const overlappingSessionsData = useSelector(
    (state) => state.dataBank.overlappingSessionsData,
    shallowEqual
  );
  const userid_key = useSelector((state) => state.dataBank.user.userid_key);

  const start_timestamp = useSelector(
    (state) => state.dataBank.timeMode.start_timestamp_string
  );
  const end_timestamp = useSelector(
    (state) => state.dataBank.timeMode.end_timestamp_string
  );
  const current_timestamp = useSelector(
    (state) => state.dataBank.timeMode.current_timestamp_string
  );

  const primary_mode = useSelector((state) => state.viewMode.mode.primary_mode);
  const secondary_mode = useSelector(
    (state) => state.viewMode.mode.secondary_mode
  );

  const sessionStatus = {
    NORMAL: "bar-normal",
    CONTACTED: "bar-contacted",
  };

  return (
    <>
      {primary_mode === "Track User Location" &&
      secondary_mode === "Real-time" ? (
        <SessionGanttChart
          sessions={overlappingSessionsData.data.overlaps}
          tickFormat={"%d %b %y %H:%M"}
          userIDs={[
            ...new Set(
              overlappingSessionsData.data.overlaps.map((x) => x.userID)
            ),
          ].sort((a, b) => a - b)}
          sessionStatus={sessionStatus}
          start_timestamp={start_timestamp}
          end_timestamp={end_timestamp}
          current_timestamp={current_timestamp}
          current_userid_key={userid_key}
        />
      ) : (
        <SessionHistogram
          data={overlappingSessionsData.data.total_overlap_duration_per_userid}
          current_userid_key={userid_key}
        />
      )}
    </>
  );
};
export default SessionOverlaps;
