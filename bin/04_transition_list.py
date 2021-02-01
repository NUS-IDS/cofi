#!/bin/python
#
# TRANSITION LIST
# ===============
#
# This executable produces the building transition list, mapping the
# arrival and departure time of each user from each building.
#
# Arrival and departure times stands for the first session start and last
# session end time from contiguous list of sessions that took place in the same
# building. It does not mean that a user had an uninterrupted session in the
# same building. It could be the case that a user had several sessions between
# an arrival and departure time using multiple different APs in the same
# building pair. It also does not mean that the individual was in the building
# for the whole period, the individual could have left the university and back
# connecting always from the same building.

import logging
import argparse
from pathlib import Path
from __init__ import init_db_engine, resolve_args


def create_transition_list(engine):

    with engine.begin() as conn:
        conn.execute(
            f"""
        CREATE MATERIALIZED VIEW IF NOT EXISTS views.bdg_transition AS
        SELECT
            userid_key,
            building_key,
            min(session_start) AS arrival_time,
            max(session_end) AS departure_time
        FROM (
            SELECT
                userid_key,
                building_key,
                session_start,
                session_end,
                SUM(next_same_building) OVER (
                    PARTITION BY f.userid_key
                    ORDER BY f.session_start
                    RANGE BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
                ) AS block
            FROM (
                SELECT
                    f.userid_key,
                    ap.building_key,
                    f.session_start,
                    f.session_end,
                    CASE 
                        WHEN ((LEAD(ap.building_key) OVER w) = ap.building_key) THEN 0
                        ELSE 1
                    END AS next_same_building
                FROM views.stationary_session f, dimension.ap
                WHERE ap.key = f.ap_key
                WINDOW w AS (PARTITION BY f.userid_key ORDER BY f.session_start)
            ) f
        ) f
        GROUP BY userid_key, building_key, block
        ORDER BY userid_key, arrival_time
        WITH NO DATA
        """
        )
        conn.execute(
            f"""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_bdg_transition_userid_key_arrival_time
        ON views.bdg_transition (userid_key, arrival_time)
        """
        )
        conn.execute("REFRESH MATERIALIZED VIEW views.bdg_transition")


def main(args):

    engine = init_db_engine()
    logging.info("Creating the transition list.")
    create_transition_list(engine)


if __name__ == "__main__":

    here = Path(__file__)
    cli = argparse.ArgumentParser(description="Creates the transition list.")
    cli.add_argument(
        "-e",
        "--env-file",
        default=(here / "../../../.env"),
        metavar="",
        help="environment file with database connection settings.",
    )
    args = resolve_args(cli)
    main(args)
