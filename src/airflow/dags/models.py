import enum
import logging
import pendulum

from sqlalchemy import (
    and_,
    Boolean,
    case,
    cast,
    create_engine,
    Column,
    column,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    extract,
    ForeignKey,
    func,
    Index,
    Integer,
    literal,
    literal_column,
    Numeric,
    null,
    select,
    Text,
    Table,
    type_coerce,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import insert, INTERVAL
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from sqlalchemy_fdw import ForeignDataWrapper, ForeignTable

from environment import WIFI_CONN, POSTGRES_IMPORT

WIFI_CONN = WIFI_CONN.replace("postgres://", "pgfdw://")
engine = create_engine(WIFI_CONN)
Session = sessionmaker(bind=engine)

Base = declarative_base()


class ETLStatus(enum.Enum):
    """
    Possible states a found file can be in.
    """

    ongoing = 1
    completed = 2
    quarantine = 3


class ETL(Base):
    """
    Table for storing the state of an ETL task_.
    """

    __tablename__ = "etl"
    __table_args__ = {"schema": "etl"}

    id = Column(Integer, primary_key=True)
    task_type = Column(Text)
    task_name = Column(Text)
    task_timestamp = Column(DateTime)
    status = Column(Enum(ETLStatus))
    triggered = Column(DateTime(timezone=True))

    def __init__(self, task_type, task_name, task_timestamp, status):
        self.task_type = task_type
        self.task_name = f"{task_name}"
        self.task_timestamp = task_timestamp
        self.status = status
        self.triggered = pendulum.now()

    @classmethod
    def commit_new(cls, task_type, task_name, task_timestamp, session):
        """ add a newly triggered task to the table as ongoing. """
        most_recent = cls.get_most_recent(task_type, task_name, task_timestamp, session)
        if (
            most_recent
            and most_recent.status.name == "completed"
            and task_type != "consolidation"
        ):
            raise Exception("Once a task is completed it should not be re-triggered.")
        else:
            row = cls(task_type, task_name, task_timestamp, "ongoing")
            session.add(row)
            session.commit()

    @classmethod
    def get_most_recent(cls, task_type, task_name, task_timestamp, session):
        """ for a given task return the most recent status. """
        q = (
            session.query(cls)
            .filter(
                and_(
                    cls.task_type == task_type,
                    cls.task_name == f"{task_name}",
                    cls.task_timestamp == task_timestamp,
                )
            )
            .order_by(cls.triggered.desc())
            .first()
        )
        return q

    @classmethod
    def set_status(cls, task_type, task_name, task_timestamp, status, session):
        """ create a new row for a given task_name with a new status. """
        most_recent = cls.get_most_recent(task_type, task_name, task_timestamp, session)
        if (
            most_recent
            and most_recent.status.name == "completed"
            and task_type != "consolidation"
        ):
            raise Exception("Once a task is completed it should not be re-triggered.")
        else:
            new = cls(task_type, task_name, task_timestamp, status)
            session.add(new)
            session.commit()

    @classmethod
    def can_process(cls, task_type, task_name, task_timestamp, session):
        """determine if we should continue with the task.
        If we have never seen it or it's most recent status is
        quarantined then we will begin the task.
        """
        most_recent = cls.get_most_recent(task_type, task_name, task_timestamp, session)
        seen = most_recent is not None
        if seen:
            if task_type != "consolidation":
                can = most_recent.status.name == "quarantine"
            else:
                can = (task_type == "consolidation") and (
                    most_recent.status.name != "ongoing"
                )
        else:
            can = False
        return (not seen) or can

    @classmethod
    def ready_for_consolidation(cls, session):
        """ determine which tables are ready for consolidation. """
        ingested = (
            session.query(
                cls.task_timestamp, func.max(cls.triggered).label("triggered")
            )
            .filter(and_(cls.task_type == "session_file", cls.status == "completed"))
            .group_by(cls.task_timestamp)
            .all()
        )
        if len(ingested) > 0:
            ingested = {
                pendulum.instance(date).naive(): triggered
                for date, triggered in ingested
            }
        else:
            ingested = {}

        consolidated = (
            session.query(
                cls.task_timestamp, func.max(cls.triggered).label("triggered")
            )
            .filter(and_(cls.task_type == "consolidation", cls.status == "completed"))
            .group_by(cls.task_timestamp)
            .all()
        )
        if len(consolidated) > 0:
            consolidated = {
                pendulum.instance(date).naive(): triggered
                for date, triggered in consolidated
            }
        else:
            consolidated = {}

        dates_for_consolidation = []

        for date in ingested.keys():
            if (date not in consolidated) or (ingested[date] > consolidated[date]):
                dates_for_consolidation.append(date)

        return dates_for_consolidation


class DimensionMixin:
    @classmethod
    def get_column_mapping(cls, extract):
        update_columns, extract_columns = zip(*cls.extract_mapping.items())
        update_columns = [cls.__table__.c[c] for c in update_columns]
        extract_columns = [extract.c[c] for c in extract_columns]
        return update_columns, extract_columns

    @classmethod
    def where_clause(cls, extract):
        update_columns, extract_columns = cls.get_column_mapping(extract)
        condition = [c == e for c, e in zip(update_columns, extract_columns)]
        return and_(*condition)

    @classmethod
    def update(cls, extract):
        """ update table with newly extracted data. """
        table = cls.__table__
        logging.info(f"Updating: {table}")
        update_columns, extract_columns = cls.get_column_mapping(extract)
        logging.info(f"Update columns: {update_columns}")
        logging.info(f"Extract columns: {extract_columns}")
        with engine.begin() as conn:
            new_data = select(extract_columns).distinct()
            if "prepopulated" in cls.__table__.c:
                new_data = select(
                    [
                        new_data.alias("new_data"),
                        literal_column("FALSE as prepopulated"),
                    ]
                )
                update_columns.append(cls.__table__.c["prepopulated"])
            # conflicts will arise whenever there are non-unique dimensions, we
            # skip inserting these dimensions
            conn.execute(
                insert(table)
                .from_select(update_columns, new_data)
                .on_conflict_do_nothing()
            )


class SessionStatus(enum.Enum):
    """
    Possible states a session can be in.
    """

    ongoing = 1
    completed = 2


class User(DimensionMixin, Base):
    __tablename__ = "userid"
    __table_args__ = {"schema": "dimension"}

    key = Column(Integer, primary_key=True)
    name = Column(Text, unique=True)

    extract_mapping = {"name": "username"}


class Mac(DimensionMixin, Base):
    __tablename__ = "mac"
    __table_args__ = {"schema": "dimension"}

    key = Column(Integer, primary_key=True)
    address = Column(Text, unique=True)

    extract_mapping = {"address": "macaddress"}


class AP(DimensionMixin, Base):
    __tablename__ = "ap"
    __table_args__ = {"schema": "dimension"}

    key = Column(Integer, primary_key=True)
    name = Column(Text)
    path = Column(Text)
    prepopulated = Column(Boolean)

    UniqueConstraint("name", "path")

    extract_mapping = {"name": "apname", "path": "location"}


class SSID(DimensionMixin, Base):
    __tablename__ = "ssid"
    __table_args__ = {"schema": "dimension"}

    key = Column(Integer, primary_key=True)
    name = Column(Text, unique=True)
    prepopulated = Column(Boolean)

    extract_mapping = {"name": "ssid"}


class Protocol(DimensionMixin, Base):
    __tablename__ = "protocol"
    __table_args__ = {"schema": "dimension"}

    key = Column(Integer, primary_key=True)
    name = Column(Text, unique=True)
    prepopulated = Column(Boolean)

    extract_mapping = {"name": "protocol"}


class SessionDay(Base):
    __tablename__ = "day"
    __table_args__ = {"schema": "dimension"}

    key = Column(Integer, primary_key=True)
    day = Column(Date, unique=True)
    prepopulated = Column(Boolean)

    @classmethod
    def where_clause(cls, timestamp_column, alias=None):
        if alias:
            return cast(timestamp_column, Date) == literal_column(f"{alias}.day")
        else:
            return cast(timestamp_column, Date) == cls.__table__.c.day


class Fact:

    sessionstatus = Enum(SessionStatus, validate_strings=True, metadata=Base.metadata)

    @classmethod
    def extract_table(cls, file_basename, name):
        """get corresponding extract foreign table,
        mapping the csv file to the database."""

        if name not in Base.metadata.tables:

            schema, table_name = name.split(".")

            table = ForeignTable(
                table_name,
                Base.metadata,
                Column("username", Text),
                Column("macaddress", Text),
                Column("protocol", Text),
                Column("apname", Text),
                Column("location", Text),
                Column("ssid", Text),
                Column("sessionstarttime", DateTime(timezone=False)),
                Column("sessionendtime", DateTime(timezone=False)),
                Column("pulltime", DateTime(timezone=False)),
                Column("rssi", Integer),
                schema="etl",
                pgfdw_server="csv_fdw",
                pgfdw_options={
                    "filename": f"{POSTGRES_IMPORT / file_basename}",
                    "format": "csv",
                    "header": "true",
                },
            )

        return Base.metadata.tables[name]

    @classmethod
    def child_or_load_table(cls, date, name=None):
        """join extract table with dimension keys and get corresponding load
        table."""

        date_str = date.format("YYYY_MM_DD")
        next_date_str = date.add(days=1).format("YYYY_MM_DD")

        if name:
            schema, table_name = name.split(".")
        else:
            schema = "fact"
            table_name = f"session_{date_str}"

        if f"{schema}.{table_name}" not in Base.metadata.tables:

            table = Table(
                table_name,
                Base.metadata,
                Column("userid_key", Integer, ForeignKey("dimension.userid.key")),
                Column("mac_key", Integer, ForeignKey("dimension.mac.key")),
                Column("ap_key", Integer, ForeignKey("dimension.ap.key")),
                Column("ssid_key", Integer, ForeignKey("dimension.ssid.key")),
                Column("protocol_key", Integer, ForeignKey("dimension.protocol.key")),
                Column("session_start", DateTime(timezone=False)),
                Column(
                    "session_start_day_key", Integer, ForeignKey("dimension.day.key")
                ),
                Column("session_end", DateTime(timezone=False)),
                Column("session_end_day_key", Integer, ForeignKey("dimension.day.key")),
                Column("session_duration", INTERVAL),
                Column("pulltime", DateTime(timezone=False)),
                Column("pulltime_day_key", Integer, ForeignKey("dimension.day.key")),
                Column("pulltime_last", Boolean),
                Column("status", cls.sessionstatus),
                Column("rssi", Integer),
                CheckConstraint(
                    f"""
                    session_start >= '{date_str}'::TIMESTAMP AND
                    session_start < '{next_date_str}'::TIMESTAMP
                    """
                ),
                schema=schema,
            )

        return Base.metadata.tables[f"{schema}.{table_name}"]

    @classmethod
    def update_dimension(cls, extract_table):
        """ update dimension from the new data. """
        User.update(extract_table)
        Mac.update(extract_table)
        AP.update(extract_table)
        SSID.update(extract_table)
        Protocol.update(extract_table)
        logging.info("All dimensions were updated.")

    @classmethod
    def remove_tables(cls, *args):

        with engine.begin() as conn:
            for name in args:
                if name in Base.metadata.tables:
                    table = Base.metadata.tables[name]
                    table.drop(bind=conn)
                    Base.metadata.remove(table)

    @classmethod
    def etl(cls, date, file_basename, extract_table_name, load_table_name):
        """performs the etl process.

        Extracts the csv file to a foreign table, than copy its
        content to a fact table.

        Create a fact table corresponding to the target date if it
        has not been created yet. In case, the table already exists, we
        insert to the existing table and remove duplicates, leaving the
        entry with the latest pulltime.
        """

        extract = cls.extract_table(file_basename, extract_table_name)
        load = cls.child_or_load_table(date, load_table_name)
        child_fact = cls.child_or_load_table(date)

        logging.basicConfig()
        logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

        with engine.begin() as conn:
            logging.info("Preparing extract table create query.")
            extract.create(conn, checkfirst=True)
            logging.info("Preparing load table create query.")
            print(load)
            load.create(conn, checkfirst=True)
            logging.info("Auxiliary tables finished creating.")

        with engine.begin() as conn:
            cls.update_dimension(extract)

            extracted_fact = (
                select(
                    [
                        extract,
                        literal_column("start_day.key").label("session_start_day_key"),
                        literal_column("end_day.key").label("session_end_day_key"),
                        literal_column("pull_day.key").label("pulltime_day_key"),
                    ]
                )
                .select_from(
                    extract.join(
                        SessionDay.__table__.alias("start_day"),
                        SessionDay.where_clause(
                            extract.c.sessionstarttime, "start_day"
                        ),
                        isouter=True,
                    )
                    .join(
                        SessionDay.__table__.alias("end_day"),
                        SessionDay.where_clause(extract.c.sessionendtime, "end_day"),
                        isouter=True,
                    )
                    .join(
                        SessionDay.__table__.alias("pull_day"),
                        SessionDay.where_clause(extract.c.pulltime, "pull_day"),
                        isouter=True,
                    )
                )
                .alias("extracted_fact")
            )

            conn.execute(
                load.insert().from_select(
                    load.columns,
                    select(
                        [
                            User.key.label("userid_key"),
                            Mac.key.label("mac_key"),
                            AP.key.label("ap_key"),
                            SSID.key.label("ssid_key"),
                            Protocol.key.label("protocol_key"),
                            extracted_fact.c.sessionstarttime,
                            extracted_fact.c.session_start_day_key,
                            # adjust session end such that it is equal or later than session start
                            case(
                                [
                                    (
                                        extracted_fact.c.sessionendtime
                                        < extracted_fact.c.sessionstarttime,
                                        extracted_fact.c.sessionstarttime,
                                    )
                                ],
                                else_=extracted_fact.c.sessionendtime,
                            ),
                            case(
                                [
                                    (
                                        extracted_fact.c.sessionendtime
                                        < extracted_fact.c.sessionstarttime,
                                        extracted_fact.c.session_start_day_key,
                                    )
                                ],
                                else_=extracted_fact.c.session_end_day_key,
                            ),
                            # duration is computed during the consolidation phase below
                            null(),
                            # adjust pulltime such that it is equal or later than session start
                            case(
                                [
                                    (
                                        extracted_fact.c.pulltime
                                        < extracted_fact.c.sessionstarttime,
                                        extracted_fact.c.sessionstarttime,
                                    )
                                ],
                                else_=extracted_fact.c.pulltime,
                            ),
                            case(
                                [
                                    (
                                        extracted_fact.c.pulltime
                                        < extracted_fact.c.sessionstarttime,
                                        extracted_fact.c.session_start_day_key,
                                    )
                                ],
                                else_=extracted_fact.c.pulltime_day_key,
                            ),
                            # whether the pulltime is the last in the session
                            # is computed during the consolidation phase below
                            False,
                            # session will be ongoing if session end is null
                            case(
                                [
                                    (
                                        extracted_fact.c.sessionendtime == None,
                                        cast("ongoing", cls.sessionstatus),
                                    )
                                ],
                                else_=cast("completed", cls.sessionstatus),
                            ),
                            extracted_fact.c.rssi,
                        ]
                    ).where(
                        and_(
                            User.where_clause(extracted_fact),
                            Mac.where_clause(extracted_fact),
                            AP.where_clause(extracted_fact),
                            SSID.where_clause(extracted_fact),
                            Protocol.where_clause(extracted_fact),
                        )
                    ),
                )
            )

        if not child_fact.exists(engine):
            with engine.begin() as conn:
                # table creation encapsulated in a try because of
                # concurrency issues, we assume that whenever this fails
                # it is because the table already exists and it was
                # created by a concurrent DAG run.
                try:
                    child_fact.create(conn, checkfirst=True)
                    conn.execute(
                        f"ALTER TABLE {child_fact.fullname} INHERIT fact.session"
                    )
                except:
                    logging.info(
                        f"Failed to create table {child_fact}, it probably already exists."
                    )

        with engine.begin() as conn:
            conn.execute(
                child_fact.insert().from_select(child_fact.columns, load.select())
            )

        logging.info(f"Removing ETL tables: {extract_table_name}, {load_table_name}")
        cls.remove_tables(extract_table_name, load_table_name)

        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARN)

    @classmethod
    def consolidate(cls, date):

        child_fact = cls.child_or_load_table(date)

        logging.basicConfig()
        logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

        logging.info(f"Consolidating {child_fact.fullname}.")

        with engine.begin() as conn:
            logging.info("Creating table indices.")
            Index(None, child_fact.c.session_start).create(conn)
            Index(None, child_fact.c.session_end).create(conn)
            Index(None, child_fact.c.pulltime_last).create(conn)

        with engine.begin() as conn:

            logging.info("Removing duplicate inserts.")
            conn.execute(
                f"""
                    DELETE FROM {child_fact.fullname} T1
                           USING {child_fact.fullname} T2
                    WHERE T1.ctid > T2.ctid
                    AND   T1.pulltime = T2.pulltime
                    AND   T1.userid_key = T2.userid_key
                    AND   T1.mac_key = T2.mac_key
                    AND   T1.ap_key = T2.ap_key
                    AND   T1.ssid_key = T2.ssid_key
                    AND   T1.protocol_key = T2.protocol_key
                    AND   T1.session_start = T2.session_start;
                    """
            )

            logging.info("Resetting pulltime flag.")
            conn.execute(
                f"""
                    UPDATE {child_fact.fullname}
                    SET pulltime_last = FALSE
                    WHERE pulltime_last = TRUE;
                """
            )

            logging.info("Determining last pulltime for each session.")
            conn.execute(
                f"""
                    UPDATE {child_fact.fullname} T1
                    SET
                        pulltime_last = TRUE,
                        session_end = CASE
                            WHEN T1.status = 'ongoing' THEN T1.pulltime
                            ELSE T1.session_end
                        END,
                        session_end_day_key = CASE
                            WHEN T1.status = 'ongoing' THEN T1.pulltime_day_key
                            ELSE T1.session_end_day_key
                        END,
                        session_duration = CASE
                            WHEN T1.status = 'ongoing' THEN T1.pulltime
                            ELSE T1.session_end
                        END - T1.session_start
                    FROM (
                        SELECT DISTINCT ON (
                            userid_key,
                            mac_key,
                            ap_key,
                            ssid_key,
                            protocol_key,
                            session_start
                        )
                        userid_key,
                        mac_key,
                        ap_key,
                        ssid_key,
                        protocol_key,
                        session_start,
                        last_value(pulltime) OVER wnd AS pulltime
                        FROM {child_fact.fullname}
                        WINDOW wnd AS (
                            PARTITION BY
                                userid_key,
                                mac_key,
                                ap_key,
                                ssid_key,
                                protocol_key,
                                session_start
                            ORDER BY pulltime, ctid
                            ROWS BETWEEN
                                UNBOUNDED PRECEDING
                                AND UNBOUNDED FOLLOWING
                        )
                    ) T2
                    WHERE T1.pulltime = T2.pulltime
                    AND T1.userid_key = T2.userid_key
                    AND T1.mac_key = T2.mac_key
                    AND T1.ap_key = T2.ap_key
                    AND T1.ssid_key = T2.ssid_key
                    AND T1.protocol_key = T2.protocol_key
                    AND T1.session_start = T2.session_start;
                """
            )

            logging.info("Resolving session end and status.")
            conn.execute(
                f"""
                    UPDATE {child_fact.fullname} T1
                    SET
                        session_end = T2.session_end,
                        session_end_day_key = T2.session_end_day_key,
                        status = T2.status,
                        session_duration = T2.session_duration
                    FROM (
                        SELECT
                            userid_key,
                            mac_key,
                            ap_key,
                            ssid_key,
                            protocol_key,
                            session_start,
                            session_end,
                            session_end_day_key,
                            status,
                            session_duration
                        FROM {child_fact.fullname}
                        WHERE pulltime_last
                    ) T2
                    WHERE T1.userid_key = T2.userid_key
                    AND T1.mac_key = T2.mac_key
                    AND T1.ap_key = T2.ap_key
                    AND T1.ssid_key = T2.ssid_key
                    AND T1.protocol_key = T2.protocol_key
                    AND T1.session_start = T2.session_start;
                """
            )

        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARN)
