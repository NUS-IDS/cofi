import json
import logging
import hashlib
import pendulum

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.api.common.experimental.trigger_dag import trigger_dag

from environment import AIRFLOW_DEFAULT_ARGS

from models import Session, ETL


def sense_callable(**kwargs):
    """ look for tables to consolidate. """

    task_instance = kwargs["ti"]
    session = Session()
    dates = ETL.ready_for_consolidation(session)
    queue = []

    for date in dates:
        table_name = f"fact.session_{date.format('YYYY_MM_DD')}"
        hash = hashlib.sha1()
        hash.update(str(pendulum.now()).encode("utf-8"))
        hex = hash.hexdigest()
        table_task_dict = {
            "config": {
                "date": str(date),
                "table_name": table_name,
            },
            "run_id": f"{hex[:10]}-consolidation-{date}",
        }
        if ETL.can_process("consolidation", table_name, date, session):
            queue.append(table_name)
            task_instance.xcom_push(table_name, table_task_dict)

    task_instance.xcom_push("tables", queue)
    logging.info(f"Queued tables: {queue}")


def trigger_consolidate_callable(**kwargs):
    """ trigger consolidation tasks. """

    task_instance = kwargs["ti"]
    tables = task_instance.xcom_pull(key="tables", task_ids="sense")
    triggered = 0

    session = Session()

    for table in tables:
        table_task_dict = task_instance.xcom_pull(key=table, task_ids="sense")
        table_config = table_task_dict["config"]
        date = table_config["date"]
        table_name = table_config["table_name"]
        run_id = table_task_dict["run_id"]
        if ETL.can_process("consolidation", table_name, date, session):
            ETL.commit_new("consolidation", table_name, date, session)
            logging.info(f"Triggering {run_id}.")
            triggered += 1
            trigger_dag(
                "consolidate",
                run_id,
                conf=json.dumps(table_config),
                execution_date=pendulum.now(),
                replace_microseconds=False,
            )

    logging.info(f"A total of {triggered} consolidate tasks triggered.")

    session.close()


with DAG(
    "consolidate_sensor",
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
        python_callable=trigger_consolidate_callable,
    )

    sense >> trigger
