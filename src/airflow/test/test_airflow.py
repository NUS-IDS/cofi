import os
import sys
import pytest
import logging
import hashlib
import pendulum

from pathlib import Path
from sqlalchemy import and_, delete, select
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(".env-dev"))
os.chdir(Path(find_dotenv(".env-dev")).parent)

sys.path.insert(0, Path("src/airflow/dags").resolve().__str__())

from models import engine, Session, ETL, ETLStatus, Fact
from environment import (
    AIRFLOW_DATA,
    AIRFLOW_RAW,
    AIRFLOW_IMPORT,
    WIFI_CONN,
    POSTGRES_IMPORT,
)
from dag_etl_sensor import sense_callable as etl_sense_callable
from dag_etl import preprocess_callable
from dag_consolidate_sensor import sense_callable as consolidate_sense_callable
from dag_consolidate import consolidate_callable


class TaskInstanceMock:
    def __init__(self, task_id):
        self._xcom = {task_id: {}}
        self._task_id = task_id

    def xcom_pull(self, key, task_ids):
        return self._xcom[task_ids][key]

    def xcom_push(self, key, value, task_ids=None):
        if not task_ids:
            task_id = self._task_id
        self._xcom[task_id][key] = value

    @classmethod
    def factory(cls, mock_sensor, task_instances):
        def _ti(file_path):

            if file_path not in task_instances:
                now = pendulum.now("utc")

                with engine.begin() as conn:
                    conn.execute(delete(ETL).where(ETL.task_name == f"{file_path}"))

                file_task_dict = mock_sensor.xcom_pull(f"{file_path}", "sense")
                ti = cls("init")
                ti.xcom_push("config", file_task_dict["config"])

                task_instances[file_path] = (now, ti)
            else:
                ti = task_instances[file_path][1]

            return ti

        return _ti

    @classmethod
    def destroy(cls, task_instances):

        for (file_path, (now, ti)) in task_instances.items():

            with engine.begin() as conn:
                conn.execute(
                    delete(ETL).where(
                        and_(ETL.task_name == f"{file_path}", ETL.triggered >= now)
                    )
                )


@pytest.fixture(scope="module")
def mock_sensor():

    sensor = TaskInstanceMock("sense")
    etl_sense_callable(ti=sensor)

    return sensor


@pytest.fixture(scope="module")
def preprocess(mock_sensor):

    original_files = set(AIRFLOW_IMPORT.iterdir())
    task_instances = {}
    _ti = TaskInstanceMock.factory(mock_sensor, task_instances)

    def _preprocess(file_path):
        if file_path not in task_instances:
            ti = _ti(file_path)
            preprocess_callable(ti=ti)
        else:
            ti = _ti(file_path)
        return ti

    yield _preprocess

    new_files = set(AIRFLOW_IMPORT.iterdir()).difference(original_files)

    for f in new_files:
        f.unlink()

    TaskInstanceMock.destroy(task_instances)


@pytest.fixture(scope="module")
def session():
    session = Session()
    yield session
    session.close()


@pytest.fixture
def ingest(preprocess):

    new_tables = set()

    def _ingest(file_path):
        raw_path = AIRFLOW_RAW / f"{file_path.name[:22]}.tsv"
        ti = preprocess(raw_path)
        file_config = ti.xcom_pull("config", "init")
        extract_table_name = file_config["extract_table"]
        load_table_name = file_config["load_table"]
        date = pendulum.from_format(file_path.stem[23:], "YYYY_MM_DD").naive()
        table_name = f"fact.session_{date.format('YYYY_MM_DD')}"
        new_tables.update([table_name, extract_table_name, load_table_name])
        Fact.etl(date, file_path.name, extract_table_name, load_table_name)

    yield _ingest

    Fact.remove_tables(*new_tables)


@pytest.fixture
def task_instance(mock_sensor):

    task_instances = {}
    _ti = TaskInstanceMock.factory(mock_sensor, task_instances)
    yield _ti
    TaskInstanceMock.destroy(task_instances)


@pytest.fixture
def mock_etl(session):

    etl_entries = []

    def _mock_etl(task_type, task_name, task_timestamp, status):
        etl_entries.append((task_type, task_name, task_timestamp, status))
        ETL.set_status(task_type, task_name, task_timestamp, status, session)

    yield _mock_etl

    for (task_type, task_name, task_timestamp, status) in etl_entries:

        with engine.begin() as conn:
            conn.execute(
                delete(ETL).where(
                    and_(
                        ETL.task_type == task_type,
                        ETL.task_name == task_name,
                        ETL.task_timestamp == task_timestamp,
                        ETL.status == status,
                    )
                )
            )


@pytest.fixture
def clean_etl():

    etl_entries = []
    now = pendulum.now("utc")

    def _clean_etl(task_type, task_name, task_timestamp):
        etl_entries.append((task_type, task_name, task_timestamp))

    yield _clean_etl

    for (task_type, task_name, task_timestamp) in etl_entries:

        with engine.begin() as conn:
            conn.execute(
                delete(ETL).where(
                    and_(
                        ETL.task_type == task_type,
                        ETL.task_name == task_name,
                        ETL.task_timestamp == task_timestamp,
                        ETL.triggered > now,
                    )
                )
            )


def test_etl_sensor(mock_sensor):

    files = mock_sensor.xcom_pull("files", "sense")
    assert len(files) == 4
    assert len(mock_sensor._xcom["sense"]) == (len(files) + 1)

    file_path = files[0]
    file_task_dict = mock_sensor.xcom_pull(file_path, "sense")
    file_config = file_task_dict["config"]
    run_id = file_task_dict["run_id"]

    assert run_id.endswith(file_path)
    assert file_config["extract_table"].startswith("etl.x")
    assert file_config["load_table"].startswith("etl.l")
    assert file_config["load_table"][5:] == file_config["extract_table"][5:]


def test_etl_states(session, task_instance):

    ti = task_instance(AIRFLOW_RAW / "2020_04_01_00_00_00-v2.tsv")
    file_config = ti.xcom_pull("config", "init")
    file_name = file_config["file_name"]
    pulltime = file_config["pulltime"]

    assert ETL.can_process("pull_file", file_name, pulltime, session)

    ETL.commit_new("pull_file", file_name, pulltime, session)
    assert ETL.can_process("pull_file", file_name, pulltime, session) == False
    q = ETL.get_most_recent("pull_file", file_name, pulltime, session)
    assert q.task_type == "pull_file"
    assert q.task_name == file_name
    assert pendulum.instance(q.task_timestamp) == pendulum.from_format(
        pulltime, "YYYY-MM-DD[T]HH:mm:ss"
    )
    assert q.status == ETLStatus.ongoing

    ETL.set_status("pull_file", file_name, pulltime, "quarantine", session)
    assert ETL.can_process("pull_file", file_name, pulltime, session)
    q = ETL.get_most_recent("pull_file", file_name, pulltime, session)
    assert q.task_type == "pull_file"
    assert q.task_name == file_name
    assert pendulum.instance(q.task_timestamp) == pendulum.from_format(
        pulltime, "YYYY-MM-DD[T]HH:mm:ss"
    )
    assert q.status == ETLStatus.quarantine

    ETL.set_status("pull_file", file_name, pulltime, "completed", session)
    assert ETL.can_process("pull_file", file_name, pulltime, session) == False
    q = ETL.get_most_recent("pull_file", file_name, pulltime, session)
    assert q.task_type == "pull_file"
    assert q.task_name == file_name
    assert pendulum.instance(q.task_timestamp) == pendulum.from_format(
        pulltime, "YYYY-MM-DD[T]HH:mm:ss"
    )
    assert q.status == ETLStatus.completed

    with pytest.raises(Exception, match="Once a task is completed"):
        ETL.commit_new("pull_file", file_name, pulltime, session)
        ETL.set_status("quarantine", file_name, pulltime, "completed", session)


def test_preprocess(preprocess):

    file_stem = "2020_04_01_00_00_00-v2"
    file_path = AIRFLOW_RAW / f"{file_stem}.tsv"
    preprocess(file_path)

    new_files = list(AIRFLOW_IMPORT.glob(f"{file_stem}_*.csv"))
    assert len(new_files) == 24

    lines_before = sum(1 for _ in open(file_path))

    lines_after = 0
    for f in new_files:
        lines_after += sum(1 for _ in open(f))

    # new files contain header
    assert (lines_before + 24) == lines_after


def test_ingest_preprocessed(ingest):

    file_stem = "2020_04_01_00_00_00-v2"
    file_path = Path(f"tmp/raw/{file_stem}_2020_03_27.csv")
    ingest(file_path)

    date = pendulum.from_format(file_path.stem[23:], "YYYY_MM_DD").naive()
    child_fact = Fact.child_or_load_table(date)

    with engine.begin() as conn:
        count = conn.execute(child_fact.select()).rowcount
        assert count == 104

        count = conn.execute(
            child_fact.select(child_fact.c.session_end == None)
        ).rowcount
        assert count == 104


def test_consolidate_sensor_without_prior_consolidation(session, mock_etl):

    date1 = pendulum.from_format("2020_02_01", "YYYY_MM_DD").naive()
    date2 = pendulum.from_format("2020_04_01", "YYYY_MM_DD").naive()

    mock_etl("session_file", "foo", date1, "completed")
    mock_etl("session_file", "bar", date2, "ongoing")
    mock_etl("session_file", "bar", date2, "completed")

    sensor = TaskInstanceMock("sense")
    consolidate_sense_callable(ti=sensor)

    tables = sensor.xcom_pull(key="tables", task_ids="sense")
    assert tables == ["fact.session_2020_02_01", "fact.session_2020_04_01"]

    table_task_dict = sensor.xcom_pull(key=tables[0], task_ids="sense")
    table_config = table_task_dict["config"]
    assert table_config["date"] == str(date1)
    assert table_config["table_name"] == "fact.session_2020_02_01"


def test_consolidate_sensor_with_prior_consolidation(session, mock_etl):

    date1 = pendulum.from_format("2020_02_01", "YYYY_MM_DD").naive()
    date2 = pendulum.from_format("2020_04_01", "YYYY_MM_DD").naive()

    # we ingested these first
    mock_etl("session_file", "foo", date1, "completed")
    mock_etl("session_file", "bar", date2, "ongoing")
    mock_etl("session_file", "bar", date2, "completed")

    # which we then consolidated
    mock_etl("consolidation", "conso", date1, "completed")
    mock_etl("consoliation", "conso", date2, "completed")

    # later additional files for date2 were ingested
    mock_etl("session_file", "bar2", date2, "completed")

    sensor = TaskInstanceMock("sense")
    consolidate_sense_callable(ti=sensor)

    tables = sensor.xcom_pull(key="tables", task_ids="sense")
    assert tables == ["fact.session_2020_04_01"]

    table_task_dict = sensor.xcom_pull(key=tables[0], task_ids="sense")
    table_config = table_task_dict["config"]
    assert table_config["date"] == str(date2)
    assert table_config["table_name"] == "fact.session_2020_04_01"


def test_consolidate_sensor_all_done(session, mock_etl):

    date1 = pendulum.from_format("2020_02_01", "YYYY_MM_DD").naive()
    date2 = pendulum.from_format("2020_04_01", "YYYY_MM_DD").naive()

    # we ingested these first
    mock_etl("session_file", "foo", date1, "completed")
    mock_etl("session_file", "bar", date2, "ongoing")
    mock_etl("session_file", "bar", date2, "completed")

    # which we then consolidated
    mock_etl("consolidation", "conso", date1, "completed")
    mock_etl("consolidation", "conso", date2, "completed")

    sensor = TaskInstanceMock("sense")
    consolidate_sense_callable(ti=sensor)

    tables = sensor.xcom_pull(key="tables", task_ids="sense")
    assert len(tables) == 0
    assert len(sensor._xcom["sense"]) == 1


def test_consolidate(ingest, clean_etl):

    date = pendulum.from_format("2020_03_27", "YYYY_MM_DD").naive()

    for file_stem in ["2020_04_01_00_00_00-v2", "2020_03_27_00_00_00-v2"]:
        file_path = Path(f"tmp/raw/{file_stem}_2020_03_27.csv")
        ingest(file_path)

    table = Fact.child_or_load_table(date)
    task_instance = TaskInstanceMock("init")
    task_instance.xcom_push("config", {"date": str(date), "table_name": table.fullname})

    clean_etl("consolidation", table.fullname, date)
    consolidate_callable(ti=task_instance)

    with engine.begin() as conn:
        count = conn.execute(table.select()).rowcount
        assert count == 198

        count = conn.execute(table.select(table.c.session_end == None)).rowcount
        assert count == 0

        count = conn.execute(table.select(table.c.pulltime_last)).rowcount
        assert count == 101

        count = conn.execute(
            table.select(
                and_(table.c.pulltime_last, table.c.session_end != table.c.pulltime)
            )
        ).rowcount
        assert count == 1

        count1 = conn.execute(table.select(table.c.pulltime_last)).rowcount
        count2 = conn.execute(
            select(
                [
                    table.c.userid_key,
                    table.c.mac_key,
                    table.c.ap_key,
                    table.c.ssid_key,
                    table.c.protocol_key,
                    table.c.session_start,
                ],
                distinct=True,
            )
        ).rowcount
        assert count1 == count2
