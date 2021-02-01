#!/bin/python
#
# RANDOM SAMPLE OF USERID
# =======================
#
# Select a random sample of userids and creates a view of their sessions

import logging
import argparse
from pathlib import Path
from __init__ import init_db_engine, resolve_args


def userid_sampler(engine, seed=None):

    sql = f"""
    CREATE MATERIALIZED VIEW IF NOT EXISTS views.sample_sessions AS
    SELECT *
    FROM fact.session f
    JOIN (
        SELECT key FROM dimension.userid TABLESAMPLE BERNOULLI (10)
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

    engine = init_db_engine()
    logging.info(f"Creating sample sessions with seed {args.seed}.")
    userid_sampler(engine, args.seed)


if __name__ == "__main__":

    here = Path(__file__)
    cli = argparse.ArgumentParser(description="Userid random sampler.")
    cli.add_argument(
        "-e",
        "--env-file",
        default=(here / "../../../.env"),
        metavar="",
        help="environment file with database connection settings.",
    )
    cli.add_argument(
        "-s", "--seed", default=3454, type=int, help="random generator seed."
    )
    args = resolve_args(cli)
    main(args)
