/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { updateAllData } from "./app/dataBankSlice";

const DataWatcher = () => {
  const start_timestamp_string = useSelector(
    (state) => state.dataBank.timeMode.start_timestamp_string
  );
  const end_timestamp_string = useSelector(
    (state) => state.dataBank.timeMode.end_timestamp_string
  );
  const data_status = useSelector((state) => state.dataBank.user.data_status);
  const overlappingSessionsData_status = useSelector(
    (state) => state.dataBank.overlappingSessionsData.status
  );
  const dispatch = useDispatch();

  // Update data whenever start or end timestamps or user data_status are changed
  useEffect(() => {
    dispatch(updateAllData());
  }, [
    start_timestamp_string,
    end_timestamp_string,
    data_status,
    overlappingSessionsData_status,
  ]);

  return <></>;
};
export default DataWatcher;
