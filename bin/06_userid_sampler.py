#!/bin/python
#
# RANDOM SAMPLE OF USERID
# =======================
#
# Select a random sample of userids and creates a view of their sessions

import logging
import argparse
from sqlalchemy import create_engine
from __init__ import resolve_args


def create_view(engine, fraction=5, seed=None):

    sql = f"""
    CREATE MATERIALIZED VIEW IF NOT EXISTS views.sample_sessions AS
    SELECT *
    FROM fact.session f
    JOIN (
        SELECT key FROM dimension.userid TABLESAMPLE BERNOULLI ({int(fraction)})
    """

    if seed:
        sql += f" REPEATABLE ({int(seed)})"

    sql += f"""
    ) d
    ON f.userid_key = d.key
    WITH NO DATA
    """

    with engine.begin() as conn:
        conn.execute(sql)
        conn.execute(f"REFRESH MATERIALIZED VIEW views.sample_sessions")


def main(args):

    engine = create_engine(args.wifi_conn)
    logging.info(f"Creating sample sessions with seed {args.seed}.")
    create_view(engine, args.fraction, args.seed)


if __name__ == "__main__":

    here = Path(__file__)
    cli = argparse.ArgumentParser(description="Userid random sampler.")
    cli.add_argument(
        "-s", "--seed", default=3454, type=int, help="random generator seed."
    )
    cli.add_argument(
        "-f", "--fraction", default=5, type=int, help="fraction of userids."
    )
    args = resolve_args(cli)
    main(args)
