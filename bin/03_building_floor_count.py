#!/bin/python
#
# BUILDING FLOOR SESSION COUNT CACHE
# ==================================
#
# This executable creates a materialized view of session counts per
# building-floor pairs. First, it keeps only userid-mac pairs that are
# classified as primary according to the heuristics in
# ./user_mac_classification.py. Second, it keeps only stationary sessions (ie.
# sessions that last for more than 10 minutes).

import logging
import argparse
from pathlib import Path
from __init__ import init_db_engine, resolve_args


def create_timestamp_str(column, interval):

    interval = int(interval)
    assert interval > 0 and interval < 60

    out = (
        f"make_timestamp("
        + f"EXTRACT(YEAR FROM {column})::INTEGER, "
        + f"EXTRACT(MONTH FROM {column})::INTEGER, "
        + f"EXTRACT(DAY FROM {column})::INTEGER, "
        + f"EXTRACT(HOUR FROM {column})::INTEGER, "
        + f"{interval}*(EXTRACT(MINUTE FROM {column})::INTEGER / {interval}),"
        + f"0)"
    )

    return out


def create_view(engine):

    with engine.begin() as conn:
        conn.execute(
            f"""
        CREATE MATERIALIZED VIEW IF NOT EXISTS views.bdg_fl_count AS
        SELECT
            ap.floor_key AS bdg_fl_key,
            ap.building_key,
            ap.floor,
            f.start AS session_interval_start,
            COUNT(*) AS session_count
        FROM (
            SELECT
                ap_key,
                generate_series(
                    {create_timestamp_str('session_start', 15)},
                    {create_timestamp_str('session_end', 15)},
                    '15 minutes'
                ) AS start
            FROM views.stationary_session
            ) f
        JOIN dimension.ap ON ap.key = f.ap_key
        GROUP BY ap.floor_key, ap.building_key, ap.floor, f.start
        WITH NO DATA
        """
        )
        conn.execute("REFRESH MATERIALIZED VIEW views.bdg_fl_count")


def main(args):

    engine = init_db_engine()
    logging.info(f"Creating view.")
    create_view(engine)


if __name__ == "__main__":

    here = Path(__file__)
    cli = argparse.ArgumentParser(
        description="Create building-floor session count materialized view."
    )
    cli.add_argument(
        "-e",
        "--env-file",
        default=(here / "../../../.env"),
        metavar="",
        help="environment file with database connection settings.",
    )
    args = resolve_args(cli)
    main(args)
