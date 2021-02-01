import logging
import pendulum

from airflow import DAG
from airflow.operators.python import PythonOperator

from environment import AIRFLOW_DEFAULT_ARGS

from models import Session, ETL, Fact


def init_callable(**kwargs):
    """ init consolidate task. """
    task_instance = kwargs["ti"]
    table_config = kwargs["dag_run"].conf
    task_instance.xcom_push("config", table_config)
    logging.info(f"Table configuration: {table_config}")


def consolidate_callable(**kwargs):
    """ consolidate session table. """

    task_instance = kwargs["ti"]
    table_config = task_instance.xcom_pull(key="config", task_ids="init")

    date = table_config["date"]
    date = pendulum.from_format(date, "YYYY-MM-DD[T]HH:mm:ss").naive()

    table_name = table_config["table_name"]

    session = Session()
    try:
        Fact.consolidate(date)
        ETL.set_status("consolidation", table_name, date, "completed", session)
        session.close()
    except Exception as e:
        ETL.set_status("consolidation", table_name, date, "quarantine", session)
        session.close()
        raise e


with DAG(
    "consolidate",
    schedule_interval=None,
    default_args=AIRFLOW_DEFAULT_ARGS,
    catchup=False,
) as dag:

    init = PythonOperator(
        task_id="init",
        python_callable=init_callable,
    )

    consolidate = PythonOperator(
        task_id="consolidate",
        python_callable=consolidate_callable,
    )

    init >> consolidate
