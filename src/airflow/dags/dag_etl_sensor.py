import json
import logging
import hashlib
import pendulum

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.api.common.experimental.trigger_dag import trigger_dag

from environment import AIRFLOW_DEFAULT_ARGS, AIRFLOW_RAW, RAW_GLOB

from models import Session, ETL


def sense_callable(**kwargs):
    """ look for files to process. """

    task_instance = kwargs["ti"]

    logging.info(
        f"Looking for files with the following pattern: {AIRFLOW_RAW.resolve()}/{RAW_GLOB}"
    )
    files = list(AIRFLOW_RAW.glob(RAW_GLOB))
    session = Session()
    queue = []

    for file_name in files:

        file_config = {}

        file_config["file_name"] = str(file_name)
        file_config["file_stem"] = file_name.stem
        file_config["pulltime"] = str(
            pendulum.from_format(file_name.stem, "YYYY_MM_DD_HH_mm_ss[-v2]").naive()
        )

        hash = hashlib.sha1()
        hash.update(str(pendulum.now()).encode("utf-8"))
        hex = hash.hexdigest()

        file_config["extract_table"] = f"etl.x{hex}"
        file_config["load_table"] = f"etl.l{hex}"

        run_id = f"{hex[:10]}-{file_name}"

        file_name = file_config["file_name"]
        pulltime = file_config["pulltime"]

        file_task_dict = {"config": file_config, "run_id": run_id}

        if ETL.can_process("pull_file", file_name, pulltime, session):
            queue.append(file_name)
            task_instance.xcom_push(file_name, file_task_dict)

    task_instance.xcom_push("files", queue)
    logging.info(f"Queued files: {queue}")

    session.close()


def trigger_etl_callable(**kwargs):
    """ trigger etl tasks. """

    task_instance = kwargs["ti"]
    files = task_instance.xcom_pull(key="files", task_ids="sense")

    session = Session()

    for file_name in files:
        file_task_dict = task_instance.xcom_pull(key=file_name, task_ids="sense")
        file_config = file_task_dict["config"]
        file_name = file_config["file_name"]
        pulltime = file_config["pulltime"]
        run_id = file_task_dict["run_id"]
        if ETL.can_process("pull_file", file_name, pulltime, session):
            ETL.commit_new("pull_file", file_name, pulltime, session)
            logging.info(f"Triggering {run_id}.")
            trigger_dag(
                "etl",
                run_id,
                conf=json.dumps(file_config),
                execution_date=pendulum.now(),
                replace_microseconds=False,
            )

    session.close()


with DAG(
    "etl_sensor",
    schedule_interval=None,
    default_args=AIRFLOW_DEFAULT_ARGS,
    catchup=False,
) as dag:

    sense = PythonOperator(
        task_id="sense",
        python_callable=sense_callable,
    )

    trigger = PythonOperator(
        task_id="trigger",
        python_callable=trigger_etl_callable,
    )

    sense >> trigger
