#!/bin/python
#
# STATIONARY SESSIONS VIEW V1
# ===========================
#
# This executable computes a materialized view of the facts table with only
# stationary sessions.
#
# Stationary sessions are those sessions that: (i) lasted for at least 10 minutes;
# (ii) were completed by a userid-mac pair which was classified as main (or
# primary)
#
# We merge adjacent sessions that take place in the same AP within 10 minutes
# of each other. Sessions that take place in the same AP within 10 minutes of
# each other but are interspersed by sessions taking places in other APs are
# not merged, since they are not by definition adjacent.
#
# There is a considerable amount of overlapping sessions in the facts table
# (over 20 percent). To disentangle those sessions we bring the session end
# time of an overlapping session back to 1 second before the start of the next
# session. If sessions start at the same time we arbitrarily delete one of them.

import logging
import argparse
from sqlalchemy import create_engine
from __init__ import resolve_args


def create_view(engine):

    with engine.begin() as conn:
        conn.execute(
            f"""
        CREATE MATERIALIZED VIEW IF NOT EXISTS views.stationary_session AS
        WITH f AS (
            SELECT 
                f.userid_key,
                f.ap_key,
                f.status,
                f.session_start,
                f.session_end,
                f.session_end - f.session_start AS session_duration,
                f.rssi
            FROM (
                SELECT
                    f.userid_key,
                    f.ap_key,
                    f.status,
                    f.session_start,
                    CASE
                        WHEN f.session_end > (LEAD(session_start) OVER w) THEN
                            (LEAD(session_start) OVER w) - '1 second'::INTERVAL
                        ELSE f.session_end
                    END AS session_end,
                    f.rssi
                FROM (
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
                                PARTITION BY f.userid_key 
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
                                        (((LEAD(f.session_start) OVER w) - f.session_end) < '10 minutes') AND
                                        (((LEAD(f.ap_key) OVER w) = f.ap_key))
                                        THEN 0
                                    ELSE 1
                                END AS next_within_delta
                            FROM
                                fact.session f,
                                dimension.day d,
                                dimension.userid_mac u,
                                dimension.ap ap
                            WHERE
                                f.pulltime_last AND
                                f.session_start_day_key = d.key AND
                                d.pull_hours_missing = 0 AND
                                f.userid_key = u.userid_key AND
                                f.mac_key = u.mac_key AND
                                f.session_start_day_key = u.day_key AND
                                u.main = TRUE AND
                                f.ap_key = ap.key AND
                                ap.floor != 'N/A' AND
                                ap.floor IS NOT null AND
                                ap.building_key IS NOT null
                            WINDOW w AS (PARTITION BY f.userid_key ORDER BY f.session_start)
                        ) f
                    ) f
                    GROUP BY f.userid_key, f.ap_key, f.block
                ) f
                WINDOW w AS (PARTITION BY f.userid_key ORDER BY f.session_start)
            ) f
        )
        SELECT
            f.userid_key,
            f.ap_key,
            f.status,
            f.session_start,
            f.session_end,
            f.session_duration,
            f.rssi
        FROM f
        JOIN (
            SELECT f.userid_key FROM f GROUP BY f.userid_key
            HAVING NOT bool_or(f.session_duration > '24 hours')
        ) a
        ON f.userid_key = a.userid_key
        JOIN (
            SELECT f.userid_key, f.session_start
            FROM f
            GROUP BY f.userid_key, f.session_start
            HAVING COUNT(*) < 2
        ) b
        ON f.userid_key = b.userid_key AND f.session_start = b.session_start
        WHERE (f.session_end - f.session_start) > '10 minutes'
        ORDER BY f.session_start
        WITH NO DATA
        """
        )
        conn.execute(
            f"""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_stationary_session_userid_key_session_start
        ON views.stationary_session (userid_key, session_start)
        """
        )
        conn.execute("REFRESH MATERIALIZED VIEW views.stationary_session")


def main(args):

    engine = create_engine(args.wifi_conn)
    logging.info("Creating materialized view of stationary sessions.")
    create_view(engine)


if __name__ == "__main__":

    cli = argparse.ArgumentParser(description="Create the stationary sessions view.")
    args = resolve_args(cli)
    main(args)
