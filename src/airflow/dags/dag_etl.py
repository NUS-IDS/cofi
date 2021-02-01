import csv
import logging
import pendulum
import pandas as pd
import numpy as np
from pathlib import Path

from airflow.utils.state import State

from models import Session, ETL, Fact
from airflow import DAG
from airflow.operators.python import PythonOperator

from environment import AIRFLOW_DEFAULT_ARGS, AIRFLOW_IMPORT, RAW_GLOB


def init_callable(**kwargs):
    """ init etl task. """

    task_instance = kwargs["ti"]
    file_config = kwargs["dag_run"].conf
    task_instance.xcom_push("config", file_config)
    logging.info(f"File configuration: {file_config}")


def preprocess_callable(**kwargs):
    """ preprocess raw wifi log files. """

    task_instance = kwargs["ti"]
    file_config = task_instance.xcom_pull(key="config", task_ids="init")
    file_name = file_config["file_name"]
    file_stem = file_config["file_stem"]

    columns = [
        "username",
        "macaddress",
        "protocol",
        "apname",
        "location",
        "ssid",
        "sessionstarttime",
        "sessionendtime",
        "pulltime",
        "rssi",
    ]

    df = pd.read_csv((file_name), header=None, sep="\t", quoting=csv.QUOTE_NONE)
    df.columns = columns
    df.fillna("N/A", inplace=True)

    df["sessionstarttime"] = pd.to_datetime(df["sessionstarttime"], unit="ms").dt.floor(
        "s"
    )
    df["sessionendtime"] = pd.to_datetime(df["sessionendtime"], unit="ms").dt.floor("s")
    df["pulltime"] = pd.to_datetime(df["pulltime"], unit="s")

    # we add the timezone offset as the data is collected in GMT+00:00
    timezone_offset = pd.Timedelta("8 hours")
    df["sessionstarttime"] = df["sessionstarttime"] + timezone_offset
    df["sessionendtime"] = df["sessionendtime"] + timezone_offset
    df["pulltime"] = df["pulltime"] + timezone_offset

    logging.info(f"Original file, number of rows: {len(df)}.")
    df = df[-df.duplicated()]
    logging.info(f"After removal of duplicates, number of rows: {len(df)}.")

    # assign null values to missing end time
    missing_time = pd.to_datetime("2100-01-01 00:00:00") + timezone_offset
    df.loc[df.sessionendtime == missing_time, "sessionendtime"] = np.nan

    # save each date in a separate file
    session = Session()
    for date, group in df.groupby(df["sessionstarttime"].map(lambda x: x.date())):

        date_str = date.strftime("%Y_%m_%d")
        group_file_path = Path(AIRFLOW_IMPORT / (f"{file_stem}_{date_str}.csv"))

        if ETL.can_process("session_file", f"{group_file_path}", date_str, session):
            group.loc[:, "sessionstarttime"] = group["sessionstarttime"].dt.strftime(
                "%Y-%m-%d %H:%M:%S"
            )
            group.loc[:, "sessionendtime"] = group["sessionendtime"].dt.strftime(
                "%Y-%m-%d %H:%M:%S"
            )
            group.loc[group.sessionendtime == "NaT", "sessionendtime"] = ""
            group.loc[:, "pulltime"] = group["pulltime"].dt.strftime(
                "%Y-%m-%d %H:%M:%S"
            )
            group.to_csv(group_file_path, index=False)
            logging.info(f"Preprocessed group, {group_file_path}:\n{group.head()}")

    session.close()


def ingest_callable(**kwargs):
    """ ingest preprocessed wifi log files to database. """

    task_instance = kwargs["ti"]
    file_config = task_instance.xcom_pull(key="config", task_ids="init")

    file_stem = file_config["file_stem"]
    extract_table_name = file_config["extract_table"]
    load_table_name = file_config["load_table"]

    logging.info(f"Looping through '{file_stem}*.csv'")

    ingest_errors = []

    for file_path in AIRFLOW_IMPORT.glob(f"{file_stem}*.csv"):
        logging.info(f"Ingesting {file_path}.")
        date = pendulum.from_format(file_path.stem[23:], "YYYY_MM_DD").naive()
        session = Session()
        if ETL.can_process("session_file", file_path, date, session):
            try:
                ETL.commit_new("session_file", file_path, date, session)
                Fact.etl(date, file_path.name, extract_table_name, load_table_name)
                ETL.set_status("session_file", file_path, date, "completed", session)
                session.close()
            except:
                ingest_errors.append(file_path)
                ETL.set_status("session_file", file_path, date, "quarantine", session)
                session.close()

        if len(ingest_errors) > 0:
            logging.info(f"The following files could not be ingested: {ingest_errors}.")
            raise Exception(
                f"A total of {len(ingest_errors)} files could not be ingested. Failing DAG run"
            )


def fail_callable(**kwargs):
    """ quarantine file if any previous etl task fails. """

    task_instance = kwargs["ti"]
    file_config = task_instance.xcom_pull(key="config", task_ids="init")

    file_name = file_config["file_name"]
    pulltime = file_config["pulltime"]

    session = Session()
    ETL.set_status("pull_file", file_name, pulltime, "quarantine", session)
    session.close()


def success_callable(**kwargs):
    """ mark etl as completed. """

    task_instance = kwargs["ti"]
    file_config = task_instance.xcom_pull(key="config", task_ids="init")

    file_name = file_config["file_name"]
    pulltime = file_config["pulltime"]

    session = Session()
    ETL.set_status("pull_file", file_name, pulltime, "completed", session)
    session.close()


def clean_callable(**kwargs):
    """remove generated preprocessed files
    and fails the DAG if any previous task failed."""

    task_instance = kwargs["ti"]
    file_config = task_instance.xcom_pull(key="config", task_ids="init")

    file_stem = file_config["file_stem"]

    for file_path in AIRFLOW_IMPORT.glob(f"{file_stem}{RAW_GLOB}"):
        if file_path.exists():
            logging.info(f"Removing {file_path}.")
            file_path.unlink()

    extract_table_name = file_config["extract_table"]
    load_table_name = file_config["load_table"]
    Fact.remove_tables(extract_table_name, load_table_name)

    for task_instance in kwargs["dag_run"].get_task_instances():
        if (
            task_instance.current_state() == State.FAILED
            and task_instance.task_id != kwargs["task_instance"].task_id
        ):
            raise Exception(
                f"Failing this DAG run, because task upstream {task_instance.task_id} failed. "
            )


with DAG(
    "etl", schedule_interval=None, default_args=AIRFLOW_DEFAULT_ARGS, catchup=False
) as dag:

    init = PythonOperator(
        task_id="init",
        python_callable=init_callable,
    )

    preprocess = PythonOperator(
        task_id="preprocess",
        python_callable=preprocess_callable,
    )

    ingest = PythonOperator(
        task_id="ingest",
        python_callable=ingest_callable,
    )

    fail = PythonOperator(
        task_id="fail",
        python_callable=fail_callable,
        trigger_rule="one_failed",
    )

    success = PythonOperator(
        task_id="success",
        python_callable=success_callable,
    )

    clean = PythonOperator(
        task_id="clean",
        python_callable=clean_callable,
        trigger_rule="all_done",
    )

    init >> preprocess >> ingest
    ingest >> fail >> clean
    ingest >> success >> clean
