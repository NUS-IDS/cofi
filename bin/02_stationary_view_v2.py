#!/bin/python
#
# STATIONARY SESSIONS VIEW V2
# ===========================
#
# This executable computes a materialized view of the facts table with only
# stationary sessions.
#
# Stationary sessions are those sessions that: (i) lasted for at least 10 minutes;
# (ii) were completed by a userid-mac pair which was classified as main (or
# primary).
#
# We merge sessions that take place in the same AP within a certain interval
# (default is 10 minutes) of each other. Note that we merge sessions that take
# place in the same AP within the specified interval which might be
# interspersed by an arbitrary number of sessions within that interval. This
# procedure generates a large number of overlapping sessions that need to be
# resolved.
#
# We implement a session overlap resolution mechanism.
#
# The method works as following:
# 1. add sessions to a priority queue sorted by session start
# 2. initialize a list resolved sessions;
# 3. while the priority queue is not empty:
#   i.   pop an item from the priority queue, set it to the current session;
#   ii.  retrieve the last session from the resolved list, set it to the
#   previous session. If the resolved list is empty, append the current session
#   to the resolved list, proceed to next iteration.
#   iii. compare the current session with the previous session, if there is an
#   overlap shorten the shortest session out of the two:
#       a. If the shortest session is the previous session, reduce the previous
#       session end time to 1 second before the current session start time. If
#       previous session duration is negative, remove it from the resolved
#       list. Add the current session to the resolved list.
#       b. If the shortest session is the current session, increase the session
#       start time to 1 second after the previous session end time. Add the current
#       session back to the priority queue.
#  iv.  If there is no overlap between the previous and current session. Add
#  the current session to the resolved list.
#
# The program took about 14 hours to complete in a table with 120k userids and
# 400 million rows (55 million sessions). The warehouse was hosted in a server
# running with Intel Xeon E5 v4 2.20GHz with 40 CPU cores and 500Gb of total
# memory. The warehouse was deployed via Docker containers, only 20 CPU cores
# and 100Gb of memory were made available to it.

import enum
import asyncio
import logging
import argparse
import heapq
import datetime as dt
from tqdm import tqdm
from collections import deque

import time

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Index,
    Table,
    text,
)
from sqlalchemy.dialects.postgresql import insert, INTERVAL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine

from __init__ import resolve_args


class SessionStatus(enum.Enum):
    """
    Possible states a session can be in.
    """

    ongoing = 1
    completed = 2


class LocalityMerged:
    def __init__(self, fact_table):
        self.fact_table = fact_table
        schema = "etl"
        table_name = f"lm_{self.fact_table.replace('.', '_')}"
        self.fqn = f"{schema}.{table_name}"

    async def create(self, interval, Base, engine, force=False):
        await self._create_table(Base, engine, force)
        await self._populate(interval, Base, engine)

    async def _create_table(self, Base, engine, force):
        """ create the staging table. """

        if self.fqn not in Base.metadata.tables:

            schema, table_name = self.fqn.split(".")

            sessionstatus = Enum(
                SessionStatus, validate_strings=True, metadata=Base.metadata
            )

            table = Table(
                table_name,
                Base.metadata,
                Column("userid_key", Integer, ForeignKey("dimension.userid.key")),
                Column("ap_key", Integer, ForeignKey("dimension.ap.key")),
                Column("status", sessionstatus),
                Column("session_start", DateTime(timezone=False)),
                Column("session_end", DateTime(timezone=False)),
                Column("rssi", Integer),
                schema=schema,
            )

            if force:
                async with engine.begin() as conn:
                    if await conn.run_sync(table.exists):
                        logging.info(f"Force create. Dropping {self.fqn} first.")
                        await conn.run_sync(table.drop)

            logging.info(f"Creating {self.fqn}.")
            async with engine.begin() as conn:
                await conn.run_sync(table.create, checkfirst=True)

    async def _populate(self, interval, Base, engine):

        async with engine.begin() as conn:
            result = await conn.execute(
                text(f"SELECT userid_key FROM {self.fqn} LIMIT 1")
            )
            is_empty = len(result.fetchall()) == 0

        table = Base.metadata.tables[self.fqn]

        if is_empty:

            logging.info(f"Filling {self.fqn}.")

            sql = f"""
            INSERT INTO {self.fqn} (
            SELECT
                f.userid_key,
                f.ap_key,
                (array_agg(f.status ORDER BY f.session_start DESC))[1] AS status,
                min(f.session_start) AS session_start,
                max(f.session_end) AS session_end,
                CASE
                    WHEN SUM((EXTRACT (EPOCH FROM f.session_duration))) = 0 THEN
                        min(f.rssi)
                    ELSE
                        SUM(
                            (EXTRACT (EPOCH FROM f.session_duration)) * f.rssi
                        ) / SUM((EXTRACT (EPOCH FROM f.session_duration)))
                END AS rssi
            FROM (
                SELECT
                    f.userid_key,
                    f.ap_key,
                    f.status,
                    f.session_start,
                    f.session_end,
                    f.session_duration,
                    f.rssi,
                    SUM(next_within_delta) OVER (
                        PARTITION BY f.userid_key, f.ap_key
                        ORDER BY f.session_start
                        RANGE BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
                    ) AS block
                FROM (
                    SELECT
                        f.userid_key,
                        f.ap_key,
                        f.status,
                        f.session_start,
                        f.session_end,
                        f.session_duration,
                        f.rssi,
                        CASE
                            WHEN
                                (((LEAD(f.session_start) OVER w) - f.session_end) < '{interval}')
                                THEN 0
                            ELSE 1
                        END AS next_within_delta
                    FROM
                        (
                            SELECT * FROM {self.fact_table} f
                            WHERE f.pulltime_last
                        ) f,
                        (
                            SELECT * FROM dimension.userid_mac u
                            WHERE u.main=TRUE
                        ) u,
                        dimension.day d,
                        dimension.ap ap
                    WHERE
                        f.session_start_day_key = d.key AND
                        d.pull_hours_missing = 0 AND
                        f.mac_key = u.mac_key AND
                        f.session_start_day_key = u.day_key AND
                        f.ap_key = ap.key AND
                        ap.floor != 'N/A' AND
                        ap.floor IS NOT null AND
                        ap.building_key IS NOT null
                    WINDOW w AS (PARTITION BY f.userid_key, f.ap_key ORDER BY f.session_start)
                ) f
            ) f
            GROUP BY f.userid_key, f.ap_key, f.block
            )
            """

            async with engine.begin() as conn:
                await conn.execute(text(sql))
                await conn.run_sync(Index(None, table.c.userid_key).create)

    async def teardown(self, Base, engine):
        """ remove all the data created during this procedure. """
        async with engine.begin() as conn:
            if self.fqn in Base.metadata.tables:
                table = Base.metadata.tables[self.fqn]
                await conn.run_sync(table.drop)
                Base.metadata.remove(table)


class OverlapResolved:
    def __init__(self, userid_key, fqn):
        self.userid_key = userid_key
        self.fqn = fqn
        self.resolved = deque()
        self.pq = []
        self.attr = {}

    def resolve_one(
        self, previous_start, previous_end, current_start, current_end, current_n
    ):

        previous_duration = previous_end - previous_start
        current_duration = current_end - current_start

        # since the data is ordered we only have an overlap, if previous session
        # end is later than current session start.
        if previous_end >= current_start:
            # our heuristic is to preserve the duration of the longest session
            if previous_duration >= current_duration:
                # if there is partial overlap, we shorten the current session and
                # insert it back to the priority queue.
                if current_end > previous_end:
                    current_start = previous_end + dt.timedelta(seconds=1)
                    heapq.heappush(self.pq, [current_start, current_end, current_n])
                # if there is complete overlap, we simply discard the current session
                else:
                    pass
            else:
                # we shorten the previous session
                previous_end = current_start - dt.timedelta(seconds=1)
                # if there was only partial overlap, the previous session will be
                # left with positive shorter duration.
                if previous_end > previous_start:
                    self.resolved[-1][1] = previous_end
                # if there is complete overlap, the previous session will end up
                # with negative duration. We discard the previous session.
                else:
                    self.resolved.pop()
                # since we did not change the current session start time, we can
                # add it to the list of resolved sessions.
                self.resolved.append([current_start, current_end, current_n])
        # if there is no overlap, we are done.
        else:
            self.resolved.append([current_start, current_end, current_n])

    async def resolve(self, interval, output_table, engine):

        sql = f"SELECT * FROM {self.fqn} WHERE userid_key = '{self.userid_key}' ORDER BY session_start"

        async with engine.begin() as conn:
            result = await conn.execute(text(sql))
            for (n, row) in enumerate(result):
                self.attr[n] = {
                    "ap_key": row.ap_key,
                    "status": row.status,
                    "rssi": row.rssi,
                }
                (current_start, current_end, current_n) = heapq.heappushpop(
                    self.pq, [row.session_start, row.session_end, n]
                )
                if len(self.resolved) > 0:
                    (previous_start, previous_end, previous_n) = self.resolved[-1]
                    self.resolve_one(
                        previous_start,
                        previous_end,
                        current_start,
                        current_end,
                        current_n,
                    )
                    await self.release_resolved(interval, output_table)
                else:
                    self.resolved.append([current_start, current_end, current_n])
            while len(self.pq) > 0:
                if len(self.resolved) > 0:
                    (previous_start, previous_end, previous_n) = self.resolved[-1]
                    (current_start, current_end, current_n) = heapq.heappop(self.pq)
                    self.resolve_one(
                        previous_start,
                        previous_end,
                        current_start,
                        current_end,
                        current_n,
                    )
                    await self.release_resolved(interval, output_table)
                else:
                    (current_start, current_end, current_n) = heapq.heappop(self.pq)
                    self.resolved.append([current_start, current_end, current_n])
            await self.release_resolved(interval, output_table, last=True)

    async def release_resolved(self, interval, output_table, last=False):
        size = 0 if last else 1
        while len(self.resolved) > size:
            (session_start, session_end, session_n) = self.resolved.popleft()
            session = self.attr.pop(session_n)
            session["userid_key"] = self.userid_key
            session["session_start"] = session_start
            session["session_end"] = session_end
            session["session_duration"] = session_end - session_start
            if session["session_duration"] >= interval:
                await output_table.enqueue(session)


class Output(Table):
    def __init__(self, *args, **kw):
        self.queue = asyncio.Queue()
        super().__init__(*args, **kw)

    async def enqueue(self, session):
        await self.queue.put(session)

    async def _write_batch(self, batch_size, engine, queue_progress):
        items = []
        while (len(items) < batch_size) and (not self.queue.empty()):
            items.append(await self.queue.get())
        if len(items) > 0:
            async with engine.begin() as conn:
                await conn.execute(self.insert(), items)
            queue_progress.update(n=len(items))

    async def write_sessions(
        self, tasks, batch_size, engine, user_progress, queue_progress
    ):
        done, pending = await asyncio.wait(tasks, timeout=1)
        user_progress.update(n=len(done) - user_progress.n)

        while (len(pending) % batch_size == 0) and (len(pending) > 0):
            await self._write_batch(1000, engine, queue_progress)
            done, pending = await asyncio.wait(tasks, timeout=1)
            user_progress.update(n=len(done) - user_progress.last_print_n)

        if len(pending) == 0:
            while not self.queue.empty():
                await self._write_batch(1000, engine, queue_progress)


async def resolve_user(
    userid_key, interval, parsed_interval, locality_merged, output_table, Base, engine
):

    overlap_resolved = OverlapResolved(userid_key, locality_merged.fqn)
    await overlap_resolved.resolve(parsed_interval, output_table, engine)


async def main(args):

    args.wifi_conn = args.wifi_conn.replace("postgresql://", "postgresql+asyncpg://")

    engine = create_async_engine(args.wifi_conn, pool_size=30, max_overflow=50)
    Base = declarative_base()

    async with engine.begin() as conn:
        (parsed_interval,) = (
            await conn.execute(text(f"SELECT '{args.interval}'::INTERVAL"))
        ).first()

    output_schema, output_table = args.output_table.split(".")

    Table("userid", Base.metadata, Column("key", primary_key=True), schema="dimension")
    Table("ap", Base.metadata, Column("key", primary_key=True), schema="dimension")
    sessionstatus = Enum(SessionStatus, validate_strings=True, metadata=Base.metadata)

    output = Output(
        output_table,
        Base.metadata,
        Column("userid_key", Integer, ForeignKey("dimension.userid.key")),
        Column("ap_key", Integer, ForeignKey("dimension.ap.key")),
        Column("session_start", DateTime(timezone=False)),
        Column("session_end", DateTime(timezone=False)),
        Column("session_duration", INTERVAL),
        Column("status", sessionstatus),
        Column("rssi", Integer),
        schema=output_schema,
    )
    if args.force:
        async with engine.begin() as conn:
            if await conn.run_sync(output.exists):
                logging.info(f"Force create. Dropping {args.output_table} first.")
                await conn.run_sync(output.drop)
    logging.info(f"Creating {args.output_table}.")
    async with engine.begin() as conn:
        await conn.run_sync(output.create, checkfirst=True)

    locality_merged = LocalityMerged(args.input_table)
    await locality_merged.create(args.interval, Base, engine, args.force)

    def _resolve_user(userid_key):
        return resolve_user(
            userid_key,
            args.interval,
            parsed_interval,
            locality_merged,
            output,
            Base,
            engine,
        )

    logging.info("Retrieving users.")
    users = []
    async with engine.begin() as conn:
        if args.input_table == "fact.session":
            results = await conn.stream(text(f"SELECT key FROM dimension.userid"))
        else:
            results = await conn.stream(
                text(f"SELECT DISTINCT userid_key FROM {args.input_table}")
            )
        async for (userid_key,) in results:
            users.append(userid_key)

    logging.info("Resolving overlaps.")
    tasks = []
    user_progress = tqdm(desc="userid_key", total=len(users))
    queue_progress = tqdm(desc="inserts")
    for userid_key in users:
        task = asyncio.create_task(_resolve_user(userid_key))
        tasks.append(task)
        await output.write_sessions(tasks, 20, engine, user_progress, queue_progress)

    await output.write_sessions(tasks, -1, engine, user_progress, queue_progress)

    user_progress.clear()
    queue_progress.clear()

    async with engine.begin() as conn:
        await conn.run_sync(Index(None, output.c.session_start).create, checkfirst=True)
        await conn.run_sync(Index(None, output.c.userid_key).create, checkfirst=True)

    async with engine.begin() as conn:
        condition = f"""
        SELECT DISTINCT userid_key FROM {args.output_table}
        GROUP BY userid_key HAVING bool_or(session_duration > '48 hours')
        """
        result = await conn.execute(text(f"SELECT COUNT(*) FROM ({condition}) f"))
        logging.info(
            f"Deleting {result.scalar()} userids with session duration above 48 hours."
        )
        await conn.execute(
            text(
                f"""
            DELETE FROM {args.output_table} WHERE userid_key IN ({condition})
            """
            )
        )

    logging.info("Done.")
    user_progress.close()
    queue_progress.close()


if __name__ == "__main__":

    cli = argparse.ArgumentParser(description="Create the stationary sessions view.")
    cli.add_argument(
        "-t",
        "--interval",
        default="10 minutes",
        metavar="",
        help="the maximum interval for merging consecutive sessions within the same AP.",
    )
    cli.add_argument(
        "-o",
        "--output-table",
        default="views.stationary_session_v2",
        metavar="",
        help="fully-qualified fact output name with schema.",
    )
    cli.add_argument(
        "-i",
        "--input-table",
        default="fact.session",
        metavar="",
        help="fully-qualified input table name with schema.",
    )
    cli.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="Re-write intermediary table that contains merged sessions.",
    )
    args = resolve_args(cli)
    asyncio.run(main(args))
