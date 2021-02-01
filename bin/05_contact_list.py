#!/bin/python
#
# CONTACT LIST
# ============
#
# This executable produces a contact list of users who shared an access point
# for at least 10 minutes.

import logging
import argparse
from pathlib import Path
from __init__ import init_db_engine, resolve_args


def create_contact_list(engine):

    with engine.begin() as conn:
        conn.execute(
            f"""
        CREATE MATERIALIZED VIEW IF NOT EXISTS views.contact_list AS
        SELECT *
        FROM (
            SELECT
                a.userid_key AS userid_key,
                b.userid_key AS userid_key_other,
                a.ap_key,
                GREATEST(a.session_start, b.session_start) AS overlap_start,
                LEAST(a.session_end, b.session_end) AS overlap_end,
                LEAST(a.session_end, b.session_end) - GREATEST(a.session_start, b.session_start) AS overlap_duration
            FROM views.stationary_session a, views.stationary_session b
            WHERE
                a.ap_key = b.ap_key AND
                (a.session_start, a.session_end) OVERLAPS (b.session_start, b.session_end) AND
                a.userid_key <> b.userid_key
        ) f
        WHERE f.overlap_duration > '10 minutes'
        ORDER BY userid_key, userid_key_other, overlap_end
        WITH NO DATA
        """
        )
        conn.execute(
            f"""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_contact_list_userid_key_userid_key_other_overlap_start
        ON views.contact_list (userid_key, userid_key_other, overlap_start)
        """
        )
        conn.execute("REFRESH MATERIALIZED VIEW views.contact_list")


def main(args):

    engine = init_db_engine()
    logging.info("Creating the contact list.")
    create_contact_list(engine)


if __name__ == "__main__":

    here = Path(__file__)
    cli = argparse.ArgumentParser(description="Creates the contact list.")
    cli.add_argument(
        "-e",
        "--env-file",
        default=(here / "../../../.env"),
        metavar="",
        help="environment file with database connection settings.",
    )
    args = resolve_args(cli)
    main(args)
