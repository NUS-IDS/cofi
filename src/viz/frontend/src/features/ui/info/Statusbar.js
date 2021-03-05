/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { useSelector, shallowEqual } from "react-redux";

const Statusbar = () => {
  const loadStatus = useSelector(
    (state) => state.dataBank.loadStatus,
    shallowEqual
  );
  const user = useSelector((state) => state.dataBank.user, shallowEqual);
  const usersByID = useSelector(
    (state) => state.dataBank.usersByID,
    shallowEqual
  );

  return (
    <>
      <div>
        <div>
          <font color={loadStatus.loaded ? `white` : `white`}>
            {loadStatus.loaded
              ? "All map data loaded"
              : loadStatus.loadingMessage}
          </font>
        </div>
        <div>
          <font
            color={
              usersByID[user.userid_key].user_activity_status
                ? `white`
                : `white`
            }
          >
            {loadStatus.loaded
              ? `UserID ${user.userid_key} ${
                  usersByID[user.userid_key].user_activity_status
                    ? "has"
                    : "does not have"
                } activity in current time interval`
              : ``}
          </font>
        </div>
      </div>
    </>
  );
};
export default Statusbar;
